// The import itself, as a function: the utilityProcess entry (import.ts) only wires Electron to it, tests call it
// directly with a mock bank. Core code does the work — no copies of sync logic here. Several connections run in one
// job: their windows take turns (runPlans), each with its own client, token and request slot; a connection whose
// token is rejected (or belongs to another holder) stops alone, the others finish.
import { SyncCancelledError, cancellableSleep } from '@mono/core/cancel';
import type { Db } from '@mono/core/db';
import { RateLimitError } from '@mono/core/errors';
import { accountLabels, toKyivDate } from '@mono/core/format';
import type { Clock, FetchLike } from '@mono/core/platform';
import { rulesFor } from '@mono/core/providers/rules';
import type { ProviderId } from '@mono/core/providers/types';
import { rederiveCore } from '@mono/core/rederive';
import {
  ConnectionDuplicateError,
  ConnectionMismatchError,
  planHistory,
  runPlans,
  syncAccounts,
  type SyncContext,
  type Window,
} from '@mono/core/sync';
import type { ErrorKind, FromWorker } from '../shared/import-protocol.ts';
import type { RetryReason, WindowProgress } from '../shared/progress.ts';
import { nextRetryDelay, sleptDuringPause } from '../shared/retry.ts';
import { WORKER_PROVIDERS } from './providers.ts';

export type ImportConnection = { connectionId: number; provider: ProviderId; token: string };

export type RunImportDeps = {
  db: Db;
  /** Network for one provider, already allowlisted to its services (src/net/providers.ts). */
  fetchFor: (provider: ProviderId) => FetchLike;
  clock: Clock;
  connections: ReadonlyArray<ImportConnection>;
  sinceSec: number;
  signal: AbortSignal;
  emit: (msg: FromWorker) => void;
};

const providers = Object.values(WORKER_PROVIDERS);

/** Worker errors → a fixed, token-free text for the UI. Bank messages are already redacted by the core clients. */
export function describeError(err: unknown): { kind: ErrorKind; message: string } {
  if (err instanceof SyncCancelledError) return { kind: 'cancelled', message: 'Импорт остановлен' };
  if (err instanceof RateLimitError) return { kind: 'rate-limit', message: err.message };
  // Fixed texts of the core, without the holder id.
  if (err instanceof ConnectionMismatchError || err instanceof ConnectionDuplicateError) return { kind: 'connection', message: err.message };
  for (const p of providers) {
    const d = p.describe(err);
    if (d) return d;
  }
  if (err instanceof Error && /Неожиданный формат ответа API/.test(err.message)) return { kind: 'format', message: err.message.slice(0, 300) };
  return { kind: 'other', message: 'Импорт остановился из-за ошибки. Он продолжится со следующего запуска.' };
}

/** Failures worth waiting out: no connection / timeout, the bank's 5xx, 429 beyond the core's own retries. */
export function transientReason(err: unknown): Exclude<RetryReason, 'crash'> | null {
  if (err instanceof RateLimitError) return 'rate-limit';
  for (const p of providers) {
    const r = p.transient(err);
    if (r) return r;
  }
  return null;
}

/** Stops only its own connection: the others can go on. */
export function isConnectionFailure(err: unknown): boolean {
  const { kind } = describeError(err);
  return kind === 'auth' || kind === 'connection';
}

/** For the log: the error's name and HTTP status — never its message (it may quote a response). */
export function errorTag(err: unknown): string {
  if (!(err instanceof Error)) return 'unknown';
  for (const p of providers) {
    const t = p.tag(err);
    if (t) return t;
  }
  return err.name;
}

type Run = {
  input: ImportConnection;
  ctx: SyncContext;
  intervalSec: number;
  accountsDone: boolean;
  // Planned once; committed windows leave it, so a retry fetches exactly what is still missing (no extra
  // "up to now" window per account on every retry, as re-planning would add).
  remaining: Map<string, Window[]> | null;
};

const count = (plan: ReadonlyMap<string, readonly Window[]> | null) => [...(plan?.values() ?? [])].reduce((n, w) => n + w.length, 0);

export async function runImport(d: RunImportDeps): Promise<void> {
  let labels = new Map<string, string>();
  let windowsTotal = 0;
  let windowsDone = 0;
  let transactions = 0;
  let last: WindowProgress | null = null;
  // Current streak of transient failures; a committed window ends it.
  let failingSince: number | null = null;
  let attempt = 0;
  const failed = new Map<number, { kind: ErrorKind; message: string }>();

  const runs: Run[] = [];
  const active = () => runs.filter((r) => !failed.has(r.input.connectionId));
  // Connections fetch in parallel slots: what is left takes as long as the connection with the most windows.
  const eta = (waitSec: number) => Math.max(0, ...active().map((r) => count(r.remaining) * r.intervalSec)) + waitSec;
  const emitWait = (ms: number) => {
    if (last) d.emit({ type: 'progress', progress: { ...last, waitingSec: Math.ceil(ms / 1000), etaSec: eta(Math.ceil(ms / 1000)) } });
  };
  const fail = (r: Run, err: unknown) => {
    failed.set(r.input.connectionId, describeError(err));
    windowsTotal -= count(r.remaining);
    r.remaining = new Map();
    d.emit({ type: 'log', message: `connection ${r.input.connectionId} stopped: ${errorTag(err)}` });
  };

  for (const input of d.connections) {
    const api = WORKER_PROVIDERS[input.provider].create({
      connectionId: input.connectionId,
      token: input.token,
      db: d.db,
      fetch: d.fetchFor(input.provider),
      clock: d.clock,
      signal: d.signal,
      onWait: emitWait,
    });
    const run: Run = {
      input,
      intervalSec: rulesFor(input.provider).api.requestIntervalMs / 1000,
      accountsDone: false,
      remaining: null,
      ctx: {
        db: d.db,
        api,
        connectionId: input.connectionId,
        clock: d.clock,
        signal: d.signal,
        warn: (msg) => d.emit({ type: 'log', message: `warn: ${msg.replace(/[^\s]{16,}/g, '…').slice(0, 280)}` }),
        onEvent: (e) => {
          if (e.type === 'window-start') {
            last = {
              phase: 'windows',
              account: labels.get(e.accountId) ?? 'счёт',
              from: toKyivDate(e.window.from),
              to: toKyivDate(e.window.to),
              round: e.round,
              index: e.index,
              total: e.total,
              windowsDone,
              windowsTotal,
              transactions,
              etaSec: eta(0),
              waitingSec: null,
            };
            d.emit({ type: 'progress', progress: last });
          } else if (e.type === 'window-done') {
            windowsDone += 1;
            transactions += e.result.upserted;
            failingSince = null;
            attempt = 0;
            const left = run.remaining?.get(e.accountId);
            if (left) run.remaining!.set(e.accountId, left.filter((w) => w.from !== e.window.from || w.to !== e.window.to));
            if (last) {
              last = { ...last, windowsDone, windowsTotal, transactions, etaSec: eta(0), waitingSec: null };
              d.emit({ type: 'progress', progress: last });
            }
          } else if (e.type === 'rate-limited') {
            emitWait(e.waitMs);
          }
        },
      },
    };
    runs.push(run);
  }

  try {
    for (;;) {
      try {
        if (active().some((r) => !r.accountsDone)) {
          d.emit({ type: 'progress', progress: { phase: 'accounts' } });
          for (const r of active()) {
            if (r.accountsDone) continue;
            try {
              await syncAccounts(r.ctx);
              r.accountsDone = true;
            } catch (err) {
              if (!isConnectionFailure(err)) throw err;
              fail(r, err);
            }
          }
          const rs = await d.db.execute('SELECT id, kind, type, currency_code FROM accounts');
          labels = accountLabels(
            rs.rows.map((r) => ({ id: String(r.id), kind: String(r.kind), type: r.type === null ? null : String(r.type), currencyCode: Number(r.currency_code) })),
          );
        }
        for (const r of active()) {
          if (r.remaining) continue;
          r.remaining = await planHistory(r.ctx, { sinceSec: d.sinceSec });
          windowsTotal += count(r.remaining);
        }
        const lost = await runPlans(
          active().map((r) => ({ connectionId: r.input.connectionId, ctx: r.ctx, plan: r.remaining! })),
          isConnectionFailure,
        );
        for (const f of lost) fail(runs.find((r) => r.input.connectionId === f.connectionId)!, f.error);
        break;
      } catch (err) {
        const reason = transientReason(err);
        if (!reason) throw err;
        const now = d.clock.nowMs();
        failingSince ??= now;
        attempt += 1;
        const delay = nextRetryDelay(failingSince, now, attempt);
        if (delay === null) throw err;
        d.emit({ type: 'log', message: `retry ${attempt}: ${errorTag(err)}, next in ${delay / 1000} s` });
        d.emit({ type: 'progress', progress: { phase: 'retry', reason, attempt, inSec: delay / 1000 } });
        const pauseStart = d.clock.nowMs();
        await cancellableSleep(d.clock, delay, d.signal);
        // Time the Mac slept through the pause does not count towards the retry budget.
        const slept = sleptDuringPause(pauseStart, d.clock.nowMs(), delay);
        if (slept > 0) {
          failingSince += slept;
          d.emit({ type: 'log', message: `retry: computer slept ~${Math.round(slept / 60_000)} min, not counted` });
        }
      }
    }

    // Nothing imported at all: the first connection's reason is the job's error (one connection = as before).
    const first = failed.values().next();
    if (active().length === 0 && !first.done) {
      d.emit({ type: 'error', ...first.value });
      return;
    }
    d.emit({ type: 'progress', progress: { phase: 'rederive' } });
    const report = await rederiveCore(d.db);
    d.emit({ type: 'log', message: `rederive: ${report[0] ?? ''}`.slice(0, 300) });
    d.emit({ type: 'done', windowsTotal, transactions, failed: [...failed].map(([connectionId, f]) => ({ connectionId, ...f })) });
  } catch (err) {
    // The log line first: main closes the worker as soon as the final message (error / done) arrives.
    if (!(err instanceof SyncCancelledError)) d.emit({ type: 'log', message: `error: ${errorTag(err)}` });
    d.emit({ type: 'error', ...describeError(err) });
  }
}
