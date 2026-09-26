// The sync loop, for any provider: plan windows, fetch one window through the provider's client, write it with
// sync_state in one transaction, then the derivation passes. What a request, a page or an account looks like at the
// bank is the client's (providers/<id>/client.ts).
import { RESYNC_OVERLAP_SEC } from './constants.ts';
import { categorize, loadOverrides, recategorize, type CategoryOverride } from './categories.ts';
import type { Db, Stmt } from './db.ts';
import { RateLimitError, StatementFormatError } from './errors.ts';
import { toKyivDate } from './format.ts';
import type { Clock } from './platform.ts';
import { PARTICIPANT_LABEL_MAX, ensureDefaultConnection } from './connections.ts';
import { PROVIDER_RULES, rulesFor } from './providers/rules.ts';
import type { NormalizedTx, ProviderClient, ProviderId } from './providers/types.ts';
import { cancellableSleep, throwIfCancelled } from './cancel.ts';
import { markRefunds } from './refunds.ts';
import { rescope } from './scope.ts';
import { markInternalTransfers } from './transfers.ts';

/**
 * Window length we request from `provider`: one hour below its API maximum (Monobank: 31 d + 1 h) as a safety margin
 * against clock differences between us and the bank.
 */
export function windowSecFor(provider: ProviderId): number {
  return rulesFor(provider).api.maxWindowSec - 3600;
}

/** The default for the pure planners: the smallest window of all providers — never too long for any bank. */
export const WINDOW_SEC = Math.min(...Object.values(PROVIDER_RULES).map((p) => p.api.maxWindowSec)) - 3600;

const MAX_429_RETRIES = 3;

// ---------- types ----------

export type Window = { from: number; to: number };

export type SyncState = { oldest: number; newest: number; lastSyncAt: number | null };

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

export type CommitResult = {
  upserted: number;
  cancelledHolds: number;
  /** Non-hold transactions in the DB that the API no longer returned. Not touched, only reported. */
  missingNonHolds: number;
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
  const { externalClientId, holderName, accounts: all } = await ctx.api.accounts();
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
  if (conn.rows[0]?.label_source === 'bank') {
    const name = holderName?.replace(/\s+/g, ' ').trim().slice(0, PARTICIPANT_LABEL_MAX);
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
  const counts = { cards: accounts.filter((a) => a.kind === 'card').length, jars: accounts.filter((a) => a.kind === 'jar').length };
  ctx.onEvent?.({ type: 'accounts', ...counts });
  return counts;
}

export async function listAccountIds(db: Db): Promise<string[]> {
  // Cards first, then jars — cards are what people usually care about.
  const rs = await db.execute(`SELECT id FROM accounts ORDER BY kind = 'jar', id`);
  return rs.rows.map((r) => String(r.id));
}

export type AccountSelection = {
  selected: string[];
  /** Untracked jars with balance ≤ 0. Sync them only via an explicit --account. */
  skippedJars: Array<{ id: string; title: string | null }>;
};

/**
 * Default sync scope: every card + jars that have balance > 0 OR are already tracked (have sync_state).
 * A tracked jar stays in scope after it is emptied — otherwise its final withdrawal would never sync.
 * With `connectionId`: only that connection's accounts (a credential can fetch only its own holder's statements).
 */
export async function defaultAccountSelection(db: Db, connectionId?: number): Promise<AccountSelection> {
  const rs = await db.execute({
    sql: `SELECT a.id, a.kind, a.title, a.balance, s.account_id IS NOT NULL AS tracked
          FROM accounts a LEFT JOIN sync_state s ON s.account_id = a.id
          ${connectionId === undefined ? '' : 'WHERE a.connection_id = ?'}
          ORDER BY a.kind = 'jar', a.id`,
    args: connectionId === undefined ? [] : [connectionId],
  });
  const out: AccountSelection = { selected: [], skippedJars: [] };
  for (const r of rs.rows) {
    const id = String(r.id);
    if (r.kind === 'card' || Number(r.balance) > 0 || Number(r.tracked) === 1) out.selected.push(id);
    else out.skippedJars.push({ id, title: r.title === null ? null : String(r.title) });
  }
  return out;
}

// ---------- windows & planning (pure) ----------

/** Splits [from, to] into consecutive windows of ≤ WINDOW_SEC, oldest first. Adjacent windows share the boundary second. */
export function splitWindows(from: number, to: number, windowSec = WINDOW_SEC): Window[] {
  const out: Window[] = [];
  for (let start = from; start < to; start += windowSec) {
    out.push({ from: start, to: Math.min(start + windowSec, to) });
  }
  return out;
}

/**
 * Windows to fetch for one account, in execution order. Every window touches the already covered range,
 * so coverage [oldest, newest] stays contiguous and an interruption never leaves a hole:
 *  1. forward:  from max(oldest, newest − 3 days) up to now (oldest first) — refreshes holds, catches new data;
 *  2. backward: from oldest down to `since` (newest first) — only if `since` is older than the coverage.
 * Without coverage: from now down to `since`, newest first.
 */
export function planAccountWindows(
  state: SyncState | null,
  sinceSec: number | null,
  nowSec: number,
  windowSec = WINDOW_SEC,
): Window[] {
  if (!state) {
    if (sinceSec === null || sinceSec >= nowSec) return [];
    return splitWindows(sinceSec, nowSec, windowSec).reverse();
  }
  const forwardFrom = Math.max(state.oldest, state.newest - RESYNC_OVERLAP_SEC);
  const forward = splitWindows(forwardFrom, nowSec, windowSec);
  const backward = sinceSec !== null && sinceSec < state.oldest ? splitWindows(sinceSec, state.oldest, windowSec).reverse() : [];
  return [...forward, ...backward];
}

export async function getSyncState(db: Db, accountId: string): Promise<SyncState | null> {
  const rs = await db.execute({
    sql: 'SELECT oldest_synced_time, newest_synced_time, last_sync_at FROM sync_state WHERE account_id = ?',
    args: [accountId],
  });
  const row = rs.rows[0];
  if (!row || row.oldest_synced_time === null || row.newest_synced_time === null) return null;
  return {
    oldest: Number(row.oldest_synced_time),
    newest: Number(row.newest_synced_time),
    lastSyncAt: row.last_sync_at === null ? null : Number(row.last_sync_at),
  };
}

// ---------- one window: fetch all pages, then commit atomically ----------

/** Every operation of one window, all pages (the client's job). Nothing is written to the DB here. */
export async function fetchWindow(ctx: SyncContext, accountId: string, w: Window): Promise<NormalizedTx[]> {
  throwIfCancelled(ctx.signal);
  return ctx.api.statementWindow(accountId, w, (page, received) => {
    ctx.onEvent?.({ type: 'page', accountId, page, received });
    throwIfCancelled(ctx.signal);
  });
}

const UPSERT_TX = `INSERT INTO transactions (
    id, account_id, time, local_date, description, mcc, original_mcc, hold, amount, operation_amount,
    currency_code, commission_rate, cashback_amount, balance, comment, counter_name, counter_iban,
    counter_edrpou, receipt_id, category, is_internal_transfer, is_cancelled, raw_json, synced_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?)
  ON CONFLICT(id) DO UPDATE SET
    account_id = excluded.account_id, time = excluded.time, local_date = excluded.local_date,
    description = excluded.description, mcc = excluded.mcc, original_mcc = excluded.original_mcc,
    hold = excluded.hold, amount = excluded.amount, operation_amount = excluded.operation_amount,
    currency_code = excluded.currency_code, commission_rate = excluded.commission_rate,
    cashback_amount = excluded.cashback_amount, balance = excluded.balance, comment = excluded.comment,
    counter_name = excluded.counter_name, counter_iban = excluded.counter_iban,
    counter_edrpou = excluded.counter_edrpou, receipt_id = excluded.receipt_id,
    is_cancelled = 0, raw_json = excluded.raw_json, synced_at = excluded.synced_at`;
// On conflict, category / is_internal_transfer / transfer_* are left alone: the pass after the commit
// recomputes them for the window (a row may already be marked internal).

function upsertStatement(
  accountId: string,
  it: NormalizedTx,
  syncedAt: number,
  overrides: readonly CategoryOverride[],
  provider: ProviderId,
): Stmt {
  const description = it.description ?? '';
  // Initial category for a new row, as if not an internal transfer; the pass corrects it if it is.
  const category = categorize(
    { description, mcc: it.mcc, amount: it.amount, counterName: it.counterName ?? null, isInternalTransfer: false, isFamilyTransfer: false, provider },
    overrides,
  );
  // Optional API fields → NULL when absent. Never substitute a guessed value (e.g. amount for operationAmount).
  return {
    sql: UPSERT_TX,
    args: [
      it.id, accountId, it.time, toKyivDate(it.time), description, it.mcc, it.originalMcc ?? null,
      it.hold ? 1 : 0, it.amount, it.operationAmount ?? null, it.currencyCode, it.commissionRate ?? null,
      it.cashbackAmount ?? null, it.balance ?? null, it.comment ?? null, it.counterName ?? null, it.counterIban ?? null, it.counterEdrpou ?? null,
      it.receiptId ?? null, category, it.raw, syncedAt,
    ],
  };
}

/**
 * Writes a fully fetched window and advances sync_state in ONE transaction.
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
  const { db } = ctx;
  const nowSec = Math.floor(ctx.clock.nowMs() / 1000);

  const state = await getSyncState(db, accountId);
  if (state && (w.from > state.newest || w.to < state.oldest)) {
    throw new Error(`Окно не примыкает к покрытому периоду счёта ${accountId} — это создало бы дыру`);
  }

  const fetchedIds = new Set(items.map((i) => i.id));
  const existing = await db.execute({
    sql: `SELECT id, hold, time FROM transactions
          WHERE account_id = ? AND time > ? AND time < ? AND is_cancelled = 0`,
    args: [accountId, w.from, w.to],
  });
  const missing = existing.rows.filter((r) => !fetchedIds.has(String(r.id)));
  const cancelIds = missing.filter((r) => Number(r.hold) === 1).map((r) => String(r.id));
  const missingNonHold = missing.filter((r) => Number(r.hold) !== 1);
  for (const r of missingNonHold) {
    ctx.warn?.(
      `Транзакция ${String(r.id)} (${toKyivDate(Number(r.time))}, счёт ${accountId}) не холд, но больше не приходит из API — оставляю как есть`,
    );
  }

  const overrides = await loadOverrides(db);
  const stmts: Stmt[] = items.map((it) => upsertStatement(accountId, it, nowSec, overrides, ctx.api.provider));
  if (cancelIds.length > 0) {
    stmts.push({
      sql: `UPDATE transactions SET is_cancelled = 1, synced_at = ?
            WHERE id IN (${cancelIds.map(() => '?').join(', ')}) AND hold = 1`,
      args: [nowSec, ...cancelIds],
    });
  }
  stmts.push({
    sql: `INSERT INTO sync_state (account_id, oldest_synced_time, newest_synced_time, last_sync_at)
          VALUES (?, ?, ?, ?)
          ON CONFLICT(account_id) DO UPDATE SET
            oldest_synced_time = MIN(oldest_synced_time, excluded.oldest_synced_time),
            newest_synced_time = MAX(newest_synced_time, excluded.newest_synced_time),
            last_sync_at = excluded.last_sync_at`,
    args: [accountId, w.from, w.to, nowSec],
  });
  await db.batch(stmts);

  // Derived fields: transfer pairs may straddle windows/accounts, so the pass looks around the window.
  // The window is already committed: a failure here must not stop the sync. recategorize repairs it.
  try {
    const spans = [w, await markInternalTransfers(db, w), await markRefunds(db, w)].filter((r): r is Window => r !== null);
    const touched = { from: Math.min(...spans.map((r) => r.from)), to: Math.max(...spans.map((r) => r.to)) };
    await recategorize(db, touched);
    await rescope(db, touched);
  } catch (err) {
    ctx.warn?.(
      `Окно ${toKyivDate(w.from)} … ${toKyivDate(w.to)} счёта ${accountId} сохранено, но разметка переводов/категорий/scope ` +
        `не обновлена (${err instanceof Error ? err.message : 'неизвестная ошибка'}). Запусти recategorize.`,
    );
  }

  return { upserted: items.length, cancelledHolds: cancelIds.length, missingNonHolds: missingNonHold.length };
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
};

/** Plans all accounts up front (so the CLI can print an estimate), then runs them. */
export async function planHistory(ctx: SyncContext, opts: HistoryOptions): Promise<Map<string, Window[]>> {
  const nowSec = Math.floor(ctx.clock.nowMs() / 1000);
  const ids = opts.accountIds ?? (await defaultAccountSelection(ctx.db, await syncConnectionId(ctx))).selected;
  const plan = new Map<string, Window[]>();
  for (const id of ids) {
    plan.set(id, planAccountWindows(await getSyncState(ctx.db, id), opts.sinceSec, nowSec, windowSecFor(ctx.api.provider)));
  }
  return plan;
}

/** Log-safe: field names + transaction id + account + window. No amounts, descriptions or counterparties. */
export function describeFormatError(err: StatementFormatError, accountId: string, w: Window, index?: number, total?: number): string {
  const tx = err.transactionId ?? `#${err.itemIndex} (без id)`;
  const win = `${index !== undefined ? `окно ${index}${total !== undefined ? `/${total}` : ''} ` : 'окно '}${toKyivDate(w.from)} … ${toKyivDate(w.to)}`;
  return `Неожиданный формат ответа API: поля [${err.fields.join(', ')}], транзакция ${tx}, счёт ${accountId}, ${win}. Окно не сохранено.`;
}

export type PlannedWindow = { accountId: string; window: Window; index: number; total: number; round: number };

/**
 * Execution order across accounts: round k = the k-th window of every account (accounts in plan order).
 * Each account's own window order is kept (planAccountWindows: forward, then back in time), so the first
 * round brings every account up to now before any older history — the current month is complete early.
 */
export function interleavePlan(plan: ReadonlyMap<string, readonly Window[]>): PlannedWindow[] {
  const out: PlannedWindow[] = [];
  const rounds = Math.max(0, ...[...plan.values()].map((w) => w.length));
  for (let k = 0; k < rounds; k++) {
    for (const [accountId, windows] of plan) {
      const window = windows[k];
      if (window) out.push({ accountId, window, index: k + 1, total: windows.length, round: k + 1 });
    }
  }
  return out;
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
