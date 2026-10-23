// The sync loop, for any provider: plan windows, fetch one window through the provider's client, write it with
// sync_state in one transaction, then the derivation passes. What a request, a page or an account looks like at the
// bank is the client's (providers/<id>/client.ts).
import type { Db, Stmt } from '../storage/db.ts';
import { refreshCrossing } from '../derive/derived.ts';
import { RateLimitError, StatementFormatError } from '../shared/errors.ts';
import { toKyivDate } from '../shared/format.ts';
import type { Clock } from '../shared/platform.ts';
import { PARTICIPANT_LABEL_MAX, ensureDefaultConnection } from '../people/connections.ts';
import { bankIdOf, storedId } from '../providers/ids.ts';
import type { NormalizedTx, ProviderClient } from '../providers/types.ts';
import { cancellableSleep, throwIfCancelled } from '../shared/cancel.ts';
import { commitRows, type CommitResult } from './commit.ts';
import {
  defaultAccountSelection,
  getSyncState,
  interleavePlan,
  planAccountWindows,
  windowSecFor,
  type PlannedWindow,
  type Window,
} from './plan.ts';

const MAX_429_RETRIES = 3;

// ---------- types ----------

export type SyncEvent =
  | { type: 'accounts'; cards: number; jars: number }
  | { type: 'plan'; accountId: string; windows: number }
  /** index/total: position within the account; round: position of the window across accounts (1 = freshest). */
  | { type: 'window-start'; accountId: string; window: Window; index: number; total: number; round: number }
  | { type: 'page'; accountId: string; page: number; received: number }
  | { type: 'window-done'; accountId: string; window: Window; result: CommitResult }
  | { type: 'rate-limited'; waitMs: number; attempt: number };

export type SyncContext = {
  db: Db;
  api: ProviderClient;
  /**
   * The connection the client's credential belongs to. Absent: the single connection of the client's provider
   * (ensureDefaultConnection) — apps/mcp and the desktop app until several connections are supported.
   */
  connectionId?: number;
  clock: Clock;
  onEvent?: (e: SyncEvent) => void;
  /** Logs a warning (CLI → stderr). */
  warn?: (msg: string) => void;
  /**
   * Cancels the run (SyncCancelledError): checked before each window and page and after rate-limit waits.
   * Pass the same signal to the provider's client so waits and in-flight requests stop too.
   */
  signal?: AbortSignal;
};

// ---------- accounts ----------

export class ConnectionMismatchError extends Error {
  override name = 'ConnectionMismatchError';
}

/** The credential's holder is already another connection of the same bank (the same token or person added twice). */
export class ConnectionDuplicateError extends Error {
  override name = 'ConnectionDuplicateError';
}

/** The connection this sync writes to (see SyncContext.connectionId). */
export async function syncConnectionId(ctx: SyncContext): Promise<number> {
  return ctx.connectionId ?? ensureDefaultConnection(ctx.db, ctx.api.provider, Math.floor(ctx.clock.nowMs() / 1000));
}

/**
 * Writes the holder's accounts under the sync's connection. The bank's holder id is remembered on the first sync; a
 * credential of another holder is refused before anything is written (the id itself is never printed), and so is a
 * holder that is already another connection (ConnectionDuplicateError: the same holder id, or every account already
 * there). A single account that belongs to another connection is left as it is (warning). A participant whose label
 * comes from the bank gets the holder's name.
 */
export async function syncAccounts(ctx: SyncContext): Promise<{ cards: number; jars: number }> {
  const connectionId = await syncConnectionId(ctx);
  const { externalClientId, holderName, accounts: fetched } = await ctx.api.accounts();
  const all = fetched.map((a) => ({ ...a, id: storedId(ctx.api.provider, a.id) }));
  const now = Math.floor(ctx.clock.nowMs() / 1000);

  const conn = await ctx.db.execute({
    sql: `SELECT c.external_client_id, c.participant_id, p.label_source
          FROM connections c JOIN participants p ON p.id = c.participant_id WHERE c.id = ?`,
    args: [connectionId],
  });
  const known = conn.rows[0]?.external_client_id;
  if (known !== null && known !== undefined && externalClientId !== null && String(known) !== externalClientId) {
    throw new ConnectionMismatchError('Токен принадлежит другому аккаунту банка, чем это подключение. Данные не изменены.');
  }
  const duplicate = 'Этот аккаунт банка уже подключён в другом подключении. Данные не изменены.';
  if (externalClientId !== null) {
    const twin = await ctx.db.execute({
      sql: 'SELECT 1 FROM connections WHERE provider = ? AND external_client_id = ? AND id <> ?',
      args: [ctx.api.provider, externalClientId, connectionId],
    });
    if (twin.rows.length > 0) throw new ConnectionDuplicateError(duplicate);
  }

  const owners = await ctx.db.execute('SELECT id, connection_id FROM accounts');
  const ownerOf = new Map(owners.rows.map((r) => [String(r.id), Number(r.connection_id)]));
  const foreign = all.filter((a) => ownerOf.has(a.id) && ownerOf.get(a.id) !== connectionId);
  if (foreign.length > 0 && foreign.length === all.length && new Set(foreign.map((a) => ownerOf.get(a.id))).size === 1) {
    throw new ConnectionDuplicateError(duplicate);
  }
  if (foreign.length > 0) {
    ctx.warn?.(`Счетов уже в другом подключении: ${foreign.length} — оставлены как есть`);
  }
  const accounts = all.filter((a) => !foreign.includes(a));

  const upsert = `INSERT INTO accounts
      (id, connection_id, kind, type, currency_code, iban, masked_pan, title, goal, balance, credit_limit, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      kind = excluded.kind, type = excluded.type, currency_code = excluded.currency_code,
      iban = excluded.iban, masked_pan = excluded.masked_pan, title = excluded.title,
      goal = excluded.goal, balance = excluded.balance, credit_limit = excluded.credit_limit,
      updated_at = excluded.updated_at
    WHERE accounts.connection_id = excluded.connection_id`;
  const stmts: Stmt[] = accounts.map((a) => ({
    sql: upsert,
    args: [
      a.id, connectionId, a.kind, a.type, a.currencyCode, a.iban, a.maskedPan ? JSON.stringify(a.maskedPan) : null,
      a.title, a.goal, a.balance, a.creditLimit, now,
    ],
  }));
  if (known === null && externalClientId !== null) {
    stmts.push({ sql: 'UPDATE connections SET external_client_id = ? WHERE id = ?', args: [externalClientId, connectionId] });
  }
  // Kept even while the user's own name is the label: «взять имя из банка» applies it at once (restoreBankLabel).
  const name = holderName?.replace(/\s+/g, ' ').trim().slice(0, PARTICIPANT_LABEL_MAX);
  if (name) stmts.push({ sql: 'UPDATE connections SET holder_name = ? WHERE id = ?', args: [name, connectionId] });
  if (conn.rows[0]?.label_source === 'bank') {
    if (name) {
      stmts.push({
        sql: `UPDATE participants SET label = ? WHERE id = ? AND label_source = 'bank'`,
        args: [name, Number(conn.rows[0].participant_id)],
      });
    } else {
      ctx.warn?.('Банк не прислал имя владельца — подпись участника не изменена');
    }
  }
  if (stmts.length > 0) await ctx.db.batch(stmts);
  // A new or changed account (an IBAN, a jar's title or balance) can change which rows cross to a disabled one.
  await refreshCrossing(ctx.db);
  const counts = { cards: accounts.filter((a) => a.kind === 'card').length, jars: accounts.filter((a) => a.kind === 'jar').length };
  ctx.onEvent?.({ type: 'accounts', ...counts });
  return counts;
}

// ---------- one window: fetch all pages, then commit atomically ----------

/** Every operation of one window, all pages (the client's job, by the bank's account id). Nothing is written to the DB here. */
export async function fetchWindow(ctx: SyncContext, accountId: string, w: Window): Promise<NormalizedTx[]> {
  throwIfCancelled(ctx.signal);
  return ctx.api.statementWindow(bankIdOf(ctx.api.provider, accountId), w, (page, received) => {
    ctx.onEvent?.({ type: 'page', accountId, page, received });
    throwIfCancelled(ctx.signal);
  });
}

/**
 * Writes a fully fetched window and advances sync_state in ONE transaction. The items carry the bank's ids; they are
 * stored under storedId.
 * Also soft-cancels holds that the API no longer returns for this window.
 * Cancellation only looks strictly inside (from, to): boundary seconds are ambiguous
 * (whether the API treats `from`/`to` as inclusive is not stated), so they're never cancelled.
 */
export async function commitWindow(
  ctx: SyncContext,
  accountId: string,
  w: Window,
  items: NormalizedTx[],
): Promise<CommitResult> {
  return commitRows(ctx.db, {
    provider: ctx.api.provider,
    accountId,
    window: w,
    items: items.map((it) => ({ ...it, id: storedId(ctx.api.provider, it.id) })),
    nowSec: Math.floor(ctx.clock.nowMs() / 1000),
    cancelHolds: true,
    ...(ctx.warn ? { warn: ctx.warn } : {}),
  });
}

/** Fetch (all pages) + atomic commit. In 'wait' mode, a server 429 is waited out and retried. */
export async function syncWindow(ctx: SyncContext, accountId: string, w: Window): Promise<CommitResult> {
  for (let attempt = 1; ; attempt++) {
    try {
      const items = await fetchWindow(ctx, accountId, w);
      const result = await commitWindow(ctx, accountId, w, items);
      ctx.onEvent?.({ type: 'window-done', accountId, window: w, result });
      return result;
    } catch (err) {
      if (!(err instanceof RateLimitError) || err.source !== 'server' || attempt > MAX_429_RETRIES) throw err;
      const waitMs = err.retryAfterSec * 1000;
      ctx.onEvent?.({ type: 'rate-limited', waitMs, attempt });
      await cancellableSleep(ctx.clock, waitMs, ctx.signal);
    }
  }
}

// ---------- entry points ----------

export type HistoryOptions = {
  /** Unix seconds; null = only refresh what is already covered (forward). */
  sinceSec: number | null;
  accountIds?: string[];
  /** Re-read at least the last full window of every covered account (planAccountWindows). */
  rereadWindow?: boolean;
};

/** Plans all accounts up front (so the CLI can print an estimate), then runs them. */
export async function planHistory(ctx: SyncContext, opts: HistoryOptions): Promise<Map<string, Window[]>> {
  const nowSec = Math.floor(ctx.clock.nowMs() / 1000);
  const ids = opts.accountIds ?? (await defaultAccountSelection(ctx.db, await syncConnectionId(ctx))).selected;
  const plan = new Map<string, Window[]>();
  for (const id of ids) {
    plan.set(id, planAccountWindows(await getSyncState(ctx.db, id), opts.sinceSec, nowSec, windowSecFor(ctx.api.provider), opts.rereadWindow));
  }
  return plan;
}

/** Log-safe: field names + transaction id + account + window. No amounts, descriptions or counterparties. */
export function describeFormatError(err: StatementFormatError, accountId: string, w: Window, index?: number, total?: number): string {
  const tx = err.transactionId ?? `#${err.itemIndex} (без id)`;
  const win = `${index !== undefined ? `окно ${index}${total !== undefined ? `/${total}` : ''} ` : 'окно '}${toKyivDate(w.from)} … ${toKyivDate(w.to)}`;
  return `Неожиданный формат ответа API: поля [${err.fields.join(', ')}], транзакция ${tx}, счёт ${accountId}, ${win}. Окно не сохранено.`;
}

async function runPlannedWindow(ctx: SyncContext, p: PlannedWindow): Promise<void> {
  const { accountId, window: w, index, total, round } = p;
  throwIfCancelled(ctx.signal);
  ctx.onEvent?.({ type: 'window-start', accountId, window: w, index, total, round });
  try {
    await syncWindow(ctx, accountId, w);
  } catch (err) {
    if (err instanceof StatementFormatError) {
      throw new Error(describeFormatError(err, accountId, w, index, total), { cause: err });
    }
    throw err;
  }
}

export async function runPlan(ctx: SyncContext, plan: Map<string, Window[]>): Promise<void> {
  for (const [accountId, windows] of plan) ctx.onEvent?.({ type: 'plan', accountId, windows: windows.length });
  for (const p of interleavePlan(plan)) await runPlannedWindow(ctx, p);
}

/** One connection's part of a multi-connection run: its own context (client, credential, events) and plan. */
export type ConnectionRun = { connectionId: number; ctx: SyncContext; plan: ReadonlyMap<string, readonly Window[]> };

export type ConnectionFailure = { connectionId: number; error: unknown };

/**
 * Several connections in one run: their windows take turns (A1, B1, A2, B2 …; within a connection the order of
 * interleavePlan). Each credential has its own request slot, so while A waits for its bank's limit, B's window is
 * fetched. An error for which `isConnectionFailure` says true (a rejected credential, …) stops only that connection:
 * it is returned in the list and the others go on. Any other error (cancellation, network, …) stops the whole run.
 */
export async function runPlans(
  runs: readonly ConnectionRun[],
  isConnectionFailure: (err: unknown) => boolean = () => false,
): Promise<ConnectionFailure[]> {
  for (const { ctx, plan } of runs) {
    for (const [accountId, windows] of plan) ctx.onEvent?.({ type: 'plan', accountId, windows: windows.length });
  }
  const queues = runs.map((r) => ({ run: r, windows: interleavePlan(r.plan) }));
  const failed: ConnectionFailure[] = [];
  const rounds = Math.max(0, ...queues.map((q) => q.windows.length));
  for (let k = 0; k < rounds; k++) {
    for (const { run, windows } of queues) {
      const p = windows[k];
      if (!p || failed.some((f) => f.connectionId === run.connectionId)) continue;
      try {
        await runPlannedWindow(run.ctx, p);
      } catch (err) {
        if (!isConnectionFailure(err)) throw err;
        failed.push({ connectionId: run.connectionId, error: err });
      }
    }
  }
  return failed;
}

export type RecentStatus =
  | { accountId: string; status: 'synced'; result: CommitResult }
  | { accountId: string; status: 'not-imported' }
  | { accountId: string; status: 'needs-full-sync'; windows: number }
  | { accountId: string; status: 'rate-limited'; retryAfterSec: number };

/**
 * Incremental sync for the MCP process: only accounts whose gap to now fits in ONE window.
 * Never blocks on the rate limit (the client should be in 'fail' mode): stops at the first
 * RateLimitError and reports the remaining accounts as rate-limited.
 */
export async function syncRecent(ctx: SyncContext, accountIds?: string[]): Promise<RecentStatus[]> {
  const nowSec = Math.floor(ctx.clock.nowMs() / 1000);
  const ids = accountIds ?? (await defaultAccountSelection(ctx.db, await syncConnectionId(ctx))).selected;
  // Stalest first, so repeated calls under the rate limit eventually refresh everything.
  const withState = await Promise.all(ids.map(async (id) => ({ id, state: await getSyncState(ctx.db, id) })));
  withState.sort((a, b) => (a.state?.lastSyncAt ?? 0) - (b.state?.lastSyncAt ?? 0));

  const out: RecentStatus[] = [];
  let blocked: RateLimitError | null = null;
  for (const { id, state } of withState) {
    if (!state) {
      out.push({ accountId: id, status: 'not-imported' });
      continue;
    }
    const windows = planAccountWindows(state, null, nowSec, windowSecFor(ctx.api.provider));
    if (windows.length > 1) {
      out.push({ accountId: id, status: 'needs-full-sync', windows: windows.length });
      continue;
    }
    const w = windows[0];
    if (!w) continue;
    if (blocked) {
      out.push({ accountId: id, status: 'rate-limited', retryAfterSec: blocked.retryAfterSec });
      continue;
    }
    try {
      const items = await fetchWindow(ctx, id, w);
      out.push({ accountId: id, status: 'synced', result: await commitWindow(ctx, id, w, items) });
    } catch (err) {
      if (err instanceof StatementFormatError) throw new Error(describeFormatError(err, id, w), { cause: err });
      if (!(err instanceof RateLimitError)) throw err;
      blocked = err;
      out.push({ accountId: id, status: 'rate-limited', retryAfterSec: err.retryAfterSec });
    }
  }
  return out;
}
