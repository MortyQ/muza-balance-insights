// The sync loop, for any provider: plan windows, fetch one window through the provider's client, write it with
// sync_state in one transaction, then the derivation passes. What a request, a page or an account looks like at the
// bank is the client's (providers/<id>/client.ts).
import { RESYNC_OVERLAP_SEC } from './constants.ts';
import { categorize, loadOverrides, recategorize, type CategoryOverride } from './categories.ts';
import type { Db, Stmt } from './db.ts';
import { RateLimitError, StatementFormatError } from './errors.ts';
import { toKyivDate } from './format.ts';
import type { Clock } from './platform.ts';
import { LEGACY_PROVIDER, rulesFor } from './providers/rules.ts';
import type { NormalizedTx, ProviderClient } from './providers/types.ts';
import { cancellableSleep, throwIfCancelled } from './cancel.ts';
import { markRefunds } from './refunds.ts';
import { rescope } from './scope.ts';
import { markInternalTransfers } from './transfers.ts';

/**
 * Window length we request. One hour below the API maximum (Monobank: 31 d + 1 h) as a safety margin
 * against clock differences between us and the bank. Until connections exist, every account is Monobank's.
 */
export const WINDOW_SEC = rulesFor(LEGACY_PROVIDER).api.maxWindowSec - 3600;

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

export async function syncAccounts(ctx: SyncContext): Promise<{ cards: number; jars: number }> {
  const accounts = await ctx.api.accounts();
  const now = Math.floor(ctx.clock.nowMs() / 1000);
  const upsert = `INSERT INTO accounts
      (id, kind, type, currency_code, iban, masked_pan, title, goal, balance, credit_limit, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      kind = excluded.kind, type = excluded.type, currency_code = excluded.currency_code,
      iban = excluded.iban, masked_pan = excluded.masked_pan, title = excluded.title,
      goal = excluded.goal, balance = excluded.balance, credit_limit = excluded.credit_limit,
      updated_at = excluded.updated_at`;
  const stmts: Stmt[] = accounts.map((a) => ({
    sql: upsert,
    args: [
      a.id, a.kind, a.type, a.currencyCode, a.iban, a.maskedPan ? JSON.stringify(a.maskedPan) : null,
      a.title, a.goal, a.balance, a.creditLimit, now,
    ],
  }));
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
 */
export async function defaultAccountSelection(db: Db): Promise<AccountSelection> {
  const rs = await db.execute(`
    SELECT a.id, a.kind, a.title, a.balance, s.account_id IS NOT NULL AS tracked
    FROM accounts a LEFT JOIN sync_state s ON s.account_id = a.id
    ORDER BY a.kind = 'jar', a.id`);
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
export function planAccountWindows(state: SyncState | null, sinceSec: number | null, nowSec: number): Window[] {
  if (!state) {
    if (sinceSec === null || sinceSec >= nowSec) return [];
    return splitWindows(sinceSec, nowSec).reverse();
  }
  const forwardFrom = Math.max(state.oldest, state.newest - RESYNC_OVERLAP_SEC);
  const forward = splitWindows(forwardFrom, nowSec);
  const backward = sinceSec !== null && sinceSec < state.oldest ? splitWindows(sinceSec, state.oldest).reverse() : [];
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

function upsertStatement(accountId: string, it: NormalizedTx, syncedAt: number, overrides: readonly CategoryOverride[]): Stmt {
  const description = it.description ?? '';
  // Initial category for a new row, as if not an internal transfer; the pass corrects it if it is.
  const category = categorize(
    { description, mcc: it.mcc, amount: it.amount, counterName: it.counterName ?? null, isInternalTransfer: false },
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
  const stmts: Stmt[] = items.map((it) => upsertStatement(accountId, it, nowSec, overrides));
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
  const ids = opts.accountIds ?? (await defaultAccountSelection(ctx.db)).selected;
  const plan = new Map<string, Window[]>();
  for (const id of ids) {
    plan.set(id, planAccountWindows(await getSyncState(ctx.db, id), opts.sinceSec, nowSec));
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

export async function runPlan(ctx: SyncContext, plan: Map<string, Window[]>): Promise<void> {
  for (const [accountId, windows] of plan) ctx.onEvent?.({ type: 'plan', accountId, windows: windows.length });
  for (const { accountId, window: w, index, total, round } of interleavePlan(plan)) {
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
  const ids = accountIds ?? (await defaultAccountSelection(ctx.db)).selected;
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
    const windows = planAccountWindows(state, null, nowSec);
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
