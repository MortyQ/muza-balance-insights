// Planning an import: which accounts, which windows, in what order. Reads coverage (sync_state); writes nothing.
import { accountEnabledSql } from '../people/accounts.ts';
import { RESYNC_OVERLAP_SEC } from '../shared/constants.ts';
import type { Db } from '../storage/db.ts';
import { apiOf, TOKEN_PROVIDER_IDS } from '../providers/info.ts';
import type { ProviderId } from '../providers/types.ts';

/**
 * Window length we request from `provider`: one hour below its API maximum (Monobank: 31 d + 1 h) as a safety margin
 * against clock differences between us and the bank.
 */
export function windowSecFor(provider: ProviderId): number {
  return apiOf(provider).maxWindowSec - 3600;
}

/** The default for the pure planners: the smallest window of all API providers — never too long for any bank. */
export const WINDOW_SEC = Math.min(...TOKEN_PROVIDER_IDS.map((p) => apiOf(p).maxWindowSec)) - 3600;

export type Window = { from: number; to: number };

export type SyncState = { oldest: number; newest: number; lastSyncAt: number | null };

export async function listAccountIds(db: Db): Promise<string[]> {
  // Cards first, then jars — cards are what people usually care about.
  const rs = await db.execute(`SELECT id FROM accounts ORDER BY kind = 'jar', id`);
  return rs.rows.map((r) => String(r.id));
}

export type AccountSelection = {
  selected: string[];
  /** Jars the auto rule leaves out (untracked, balance ≤ 0). Sync them only via an explicit --account or by enabling them. */
  skippedJars: Array<{ id: string; title: string | null }>;
  /** Accounts the user turned off (accounts.sync_choice = 0): not imported until enabled; an explicit id still imports them. */
  disabled: string[];
};

/**
 * Default sync scope: the enabled accounts (accounts.ts) — the user's choice, else every card + jars that have
 * balance > 0 OR are already tracked (have sync_state). A tracked jar stays in scope after it is emptied — otherwise its
 * final withdrawal would never sync.
 * With `connectionId`: only that connection's accounts (a credential can fetch only its own holder's statements).
 */
export async function defaultAccountSelection(db: Db, connectionId?: number): Promise<AccountSelection> {
  const rs = await db.execute({
    sql: `SELECT a.id, a.title, a.sync_choice, ${accountEnabledSql('a')} AS enabled
          FROM accounts a
          ${connectionId === undefined ? '' : 'WHERE a.connection_id = ?'}
          ORDER BY a.kind = 'jar', a.id`,
    args: connectionId === undefined ? [] : [connectionId],
  });
  const out: AccountSelection = { selected: [], skippedJars: [], disabled: [] };
  for (const r of rs.rows) {
    const id = String(r.id);
    if (Number(r.enabled) === 1) out.selected.push(id);
    else if (r.sync_choice === null) out.skippedJars.push({ id, title: r.title === null ? null : String(r.title) });
    else out.disabled.push(id);
  }
  return out;
}

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
 *     with `rereadWindow`, from no later than now − one window: a short gap re-reads a whole window (one request) and
 *     catches late changes to older operations; a gap longer than that plans exactly as without it;
 *  2. backward: from oldest down to `since` (newest first) — only if `since` is older than the coverage.
 * Without coverage: from now down to `since`, newest first.
 */
export function planAccountWindows(
  state: SyncState | null,
  sinceSec: number | null,
  nowSec: number,
  windowSec = WINDOW_SEC,
  rereadWindow = false,
): Window[] {
  if (!state) {
    if (sinceSec === null || sinceSec >= nowSec) return [];
    return splitWindows(sinceSec, nowSec, windowSec).reverse();
  }
  const overlapFrom = state.newest - RESYNC_OVERLAP_SEC;
  const forwardFrom = Math.max(state.oldest, rereadWindow ? Math.min(overlapFrom, nowSec - windowSec) : overlapFrom);
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
