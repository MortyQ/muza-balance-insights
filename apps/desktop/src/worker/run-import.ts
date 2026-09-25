// The import itself, as a function: the utilityProcess entry (import.ts) only wires Electron to it, tests call it
// directly with a mock Monobank. Core code does the work — no copies of sync logic here.
import { SyncCancelledError, cancellableSleep } from '@mono/core/cancel';
import type { Db } from '@mono/core/db';
import { accountLabels, toKyivDate } from '@mono/core/format';
import { MonoApiError, RateLimitError, createMonoClient } from '@mono/core/providers/monobank/client';
import type { Clock, FetchLike } from '@mono/core/platform';
import { rederiveCore } from '@mono/core/rederive';
import { planHistory, runPlan, syncAccounts, type SyncContext, type Window } from '@mono/core/sync';
import { RATE_LIMIT_MS } from '@mono/core/providers/monobank/constants';
import type { ErrorKind, FromWorker } from '../shared/import-protocol.ts';
import type { RetryReason, WindowProgress } from '../shared/progress.ts';
import { nextRetryDelay, sleptDuringPause } from '../shared/retry.ts';

export type RunImportDeps = {
  db: Db;
  /** Already allowlisted (src/net/allowlist.ts). */
  fetch: FetchLike;
  clock: Clock;
  token: string;
  sinceSec: number;
  signal: AbortSignal;
  emit: (msg: FromWorker) => void;
};

/** Worker errors → a fixed, token-free text for the UI. Monobank messages are already redacted by the core client. */
export function describeError(err: unknown): { kind: ErrorKind; message: string } {
  if (err instanceof SyncCancelledError) return { kind: 'cancelled', message: 'Импорт остановлен' };
  if (err instanceof RateLimitError) return { kind: 'rate-limit', message: err.message };
  if (err instanceof MonoApiError) {
    if (err.status === 401 || err.status === 403) return { kind: 'auth', message: 'Monobank не принял токен. Проверь токен и введи его заново.' };
    if (err.status === null) return { kind: 'network', message: 'Нет связи с Monobank. Импорт продолжится со следующего запуска.' };
    return { kind: 'other', message: err.message.slice(0, 300) };
  }
  if (err instanceof Error && /Неожиданный формат ответа API/.test(err.message)) return { kind: 'format', message: err.message.slice(0, 300) };
  return { kind: 'other', message: 'Импорт остановился из-за ошибки. Он продолжится со следующего запуска.' };
}

/** Failures worth waiting out: no connection / timeout, Monobank 5xx, 429 beyond the core's own retries. */
export function transientReason(err: unknown): Exclude<RetryReason, 'crash'> | null {
  if (err instanceof RateLimitError) return 'rate-limit';
  if (err instanceof MonoApiError) {
    if (err.status === null) return 'network';
    if (err.status >= 500) return 'server';
  }
  return null;
}

/** For the log: the error's name and HTTP status — never its message (it may quote a response). */
export function errorTag(err: unknown): string {
  if (!(err instanceof Error)) return 'unknown';
  return err instanceof MonoApiError ? `${err.name} status=${err.status ?? 'none'}` : err.name;
}

export async function runImport(d: RunImportDeps): Promise<void> {
  let labels = new Map<string, string>();
  let windowsTotal = 0;
  let windowsDone = 0;
  let transactions = 0;
  let last: WindowProgress | null = null;
  // Current streak of transient failures; a committed window ends it.
  let failingSince: number | null = null;
  let attempt = 0;
  // Planned once; committed windows leave it, so a retry fetches exactly what is still missing (no extra
  // "up to now" window per account on every retry, as re-planning would add).
  let remaining: Map<string, Window[]> | null = null;
  const eta = (waitSec: number) => Math.max(0, windowsTotal - windowsDone) * (RATE_LIMIT_MS / 1000) + waitSec;

  const api = createMonoClient({
    token: d.token,
    db: d.db,
    fetch: d.fetch,
    clock: d.clock,
    rateLimitMode: 'wait',
    signal: d.signal,
    onWait: (ms) => {
      if (last) d.emit({ type: 'progress', progress: { ...last, waitingSec: Math.ceil(ms / 1000), etaSec: eta(Math.ceil(ms / 1000)) } });
    },
  });

  const ctx: SyncContext = {
    db: d.db,
    api,
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
        const left = remaining?.get(e.accountId);
        if (left) remaining!.set(e.accountId, left.filter((w) => w.from !== e.window.from || w.to !== e.window.to));
        if (last) {
          last = { ...last, windowsDone, transactions, etaSec: eta(0), waitingSec: null };
          d.emit({ type: 'progress', progress: last });
        }
      } else if (e.type === 'rate-limited') {
        if (last) d.emit({ type: 'progress', progress: { ...last, waitingSec: Math.ceil(e.waitMs / 1000), etaSec: eta(Math.ceil(e.waitMs / 1000)) } });
      }
    },
  };

  try {
    let accountsDone = false;
    for (;;) {
      try {
        if (!accountsDone) {
          d.emit({ type: 'progress', progress: { phase: 'accounts' } });
          await syncAccounts(ctx);
          const rs = await d.db.execute('SELECT id, kind, type, currency_code FROM accounts');
          labels = accountLabels(
            rs.rows.map((r) => ({ id: String(r.id), kind: String(r.kind), type: r.type === null ? null : String(r.type), currencyCode: Number(r.currency_code) })),
          );
          accountsDone = true;
        }
        if (!remaining) {
          remaining = await planHistory(ctx, { sinceSec: d.sinceSec });
          windowsTotal = [...remaining.values()].reduce((n, w) => n + w.length, 0);
        }
        await runPlan(ctx, remaining);
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

    d.emit({ type: 'progress', progress: { phase: 'rederive' } });
    const report = await rederiveCore(d.db);
    d.emit({ type: 'log', message: `rederive: ${report[0] ?? ''}`.slice(0, 300) });
    d.emit({ type: 'done', windowsTotal, transactions });
  } catch (err) {
    // The log line first: main closes the worker as soon as the final message (error / done) arrives.
    if (!(err instanceof SyncCancelledError)) d.emit({ type: 'log', message: `error: ${errorTag(err)}` });
    d.emit({ type: 'error', ...describeError(err) });
  }
}
