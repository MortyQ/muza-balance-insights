// Balances and sync status — the phase 5 getBalances / getSyncStatus tools. No card numbers, IBANs or jar titles:
// accounts are identified by id and a "type/CUR" label.
import { ENABLED_ACCOUNT_IDS_SQL, LIVE_ACCOUNT_IDS_SQL, accountEnabledSql, providerAccountIdsSql } from '../people/accounts.ts';
import type { ProviderId } from '../providers/types.ts';
import { SummaryError, isProviderList } from './filters.ts';
import type { Db } from '../storage/db.ts';
import { accountLabels, dateIn, toKyivDate, toKyivDateTime } from '../shared/format.ts';
import { RESYNC_OVERLAP_SEC, TIMEZONE } from '../shared/constants.ts';
import { parseProviderId } from '../people/connections.ts';
import { apiOf, TOKEN_PROVIDER_IDS } from '../providers/info.ts';
import { transferDiagnostics, type TransferDiagnostics } from '../derive/diagnostics.ts';
import { scopeCounts, type Scope } from '../derive/scope.ts';

type AccountRow = {
  id: string;
  kind: string;
  type: string | null;
  currency: number;
  balance: number;
  creditLimit: number;
  updatedAt: number;
  synced: boolean;
  oldest: number | null;
  newest: number | null;
  lastSyncAt: number | null;
};

/** Whose and which banks' accounts a balance read covers: absent — the whole family, every bank. */
export type BalanceFilters = { participantId?: number; providers?: readonly ProviderId[] };

/**
 * The enabled accounts (accounts.ts), or only those of one participant and / or some banks. Labels are made over all
 * of them, enabled or not, so a label does not change when another account is toggled.
 */
async function loadAccounts(db: Db, f: BalanceFilters = {}): Promise<{ rows: AccountRow[]; labels: Map<string, string> }> {
  if (f.providers !== undefined && !isProviderList(f.providers)) throw new SummaryError('providers: a non-empty list of known banks, each once');
  const where: string[] = [];
  const args: Array<string | number> = [];
  if (f.participantId !== undefined) {
    where.push('a.connection_id IN (SELECT id FROM connections WHERE participant_id = ?)');
    args.push(f.participantId);
  }
  if (f.providers !== undefined) {
    const banks = providerAccountIdsSql(f.providers);
    where.push(`a.id IN (${banks.sql})`);
    args.push(...banks.args);
  }
  const rs = await db.execute({
    sql: `SELECT a.id, a.kind, a.type, a.currency_code, a.balance, a.credit_limit, a.updated_at,
            s.account_id IS NOT NULL AS synced, s.oldest_synced_time, s.newest_synced_time, s.last_sync_at,
            ${accountEnabledSql('a')} AS enabled
     FROM accounts a LEFT JOIN sync_state s ON s.account_id = a.id
     ${where.length === 0 ? '' : `WHERE ${where.join(' AND ')}`}
     ORDER BY a.kind = 'jar', a.currency_code, a.id`,
    args,
  });
  const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));
  const rows = rs.rows.map((r) => ({
    id: String(r.id),
    kind: String(r.kind),
    type: r.type === null ? null : String(r.type),
    currency: Number(r.currency_code),
    balance: Number(r.balance),
    creditLimit: Number(r.credit_limit ?? 0),
    updatedAt: Number(r.updated_at),
    synced: Number(r.synced) === 1,
    oldest: num(r.oldest_synced_time),
    newest: num(r.newest_synced_time),
    lastSyncAt: num(r.last_sync_at),
    enabled: Number(r.enabled) === 1,
  }));
  const labels = accountLabels(rows.map((r) => ({ id: r.id, kind: r.kind, type: r.type, currencyCode: r.currency })));
  return { rows: rows.filter((r) => r.enabled), labels };
}

// ---------- getBalances ----------

export type AccountBalance = {
  id: string;
  label: string;
  kind: 'card' | 'jar';
  currency: number;
  /** The main number: balance − credit limit. Negative = debt on a credit card. */
  own_funds: number;
  credit_limit: number;
  /** What the bank shows and allows spending: own funds + credit limit (= API balance). */
  available: number;
  /** Kyiv date-time the bank balance was fetched (on sync). */
  updated_at: string;
};

export type Balances = {
  accounts: AccountBalance[];
  /** Own funds per currency (cards + jars); currencies are never summed together. */
  totals: Array<{ currency: number; own_funds: number }>;
};

/**
 * The enabled accounts (same rule as the sync selection: the user's choice, else cards plus jars with a positive
 * balance or a sync history). Minor units.
 * With `participantId`: that participant's accounts only; without — the whole family. With `providers`: those banks' only.
 */
export async function getBalances(db: Db, opts: BalanceFilters = {}): Promise<Balances> {
  const { rows, labels } = await loadAccounts(db, opts);
  const accounts = rows
    .map((r) => ({
      id: r.id,
      label: labels.get(r.id) ?? r.id,
      kind: r.kind === 'jar' ? ('jar' as const) : ('card' as const),
      currency: r.currency,
      own_funds: r.balance - r.creditLimit,
      credit_limit: r.creditLimit,
      available: r.balance,
      updated_at: toKyivDateTime(r.updatedAt),
    }));
  const totals = new Map<number, number>();
  for (const a of accounts) totals.set(a.currency, (totals.get(a.currency) ?? 0) + a.own_funds);
  return {
    accounts,
    totals: [...totals].sort(([a], [b]) => a - b).map(([currency, own_funds]) => ({ currency, own_funds })),
  };
}

// ---------- balancesAt ----------

export type AccountBalanceAt = Omit<AccountBalance, 'own_funds' | 'available' | 'updated_at'> & {
  /** At the end: balance − credit limit (today's limit — the bank keeps no history of it). null = no data then. */
  own_funds: number | null;
};

export type BalancesAt = {
  accounts: AccountBalanceAt[];
  /** Own funds per currency, accounts with data only. */
  totals: Array<{ currency: number; own_funds: number }>;
  /** Accounts without data at the end (imported from a later date, or never). */
  missing: number;
};

/**
 * Balances at `endSec` (exclusive: the first second after the period), the same accounts as getBalances. The bank's
 * balance after the last operation before the end; when it is missing or ambiguous (two operations in that second) —
 * today's balance minus every operation from the end on. From the moment of the last fetch on — today's balance.
 */
export async function balancesAt(db: Db, opts: { endSec: number } & BalanceFilters): Promise<BalancesAt> {
  const { rows, labels } = await loadAccounts(db, opts);
  const found = await balancesFromRows(db, rows, opts.endSec);
  const accounts: AccountBalanceAt[] = rows.map((r) => {
    const balance = opts.endSec > r.updatedAt ? r.balance : r.oldest === null || r.oldest > opts.endSec ? null : found.get(r.id)!;
    return {
      id: r.id,
      label: labels.get(r.id) ?? r.id,
      kind: r.kind === 'jar' ? 'jar' : 'card',
      currency: r.currency,
      credit_limit: r.creditLimit,
      own_funds: balance === null ? null : balance - r.creditLimit,
    };
  });
  return balancesOf(accounts);
}

/** The totals and the missing count of these accounts — also of a part of balancesAt's answer (one person's accounts). */
export function balancesOf(accounts: AccountBalanceAt[]): BalancesAt {
  const totals = new Map<number, number>();
  for (const a of accounts) if (a.own_funds !== null) totals.set(a.currency, (totals.get(a.currency) ?? 0) + a.own_funds);
  return {
    accounts,
    totals: [...totals].sort(([a], [b]) => a - b).map(([currency, own_funds]) => ({ currency, own_funds })),
    missing: accounts.filter((a) => a.own_funds === null).length,
  };
}

/**
 * The balance at `endSec` of every account the operations must answer for (covered at the end, fetched after it), in one
 * statement: per account the last non-cancelled operation before the end (an index seek on account and time); its
 * balance when it is the only one in that second and has one, else today's balance minus every operation from the end
 * up to the fetch. CASE keeps the sum lazy: SQLite runs that subquery only for an account that needs it.
 */
async function balancesFromRows(db: Db, rows: readonly AccountRow[], endSec: number): Promise<Map<string, number>> {
  const asked = rows.filter((r) => endSec <= r.updatedAt && r.oldest !== null && r.oldest <= endSec);
  if (asked.length === 0) return new Map();
  const rs = await db.execute({
    sql: `WITH acc(id, balance, upd) AS (VALUES ${asked.map(() => '(?, ?, ?)').join(', ')}),
          top AS (
            SELECT acc.*, (SELECT t.time FROM transactions t
                           WHERE t.account_id = acc.id AND t.is_cancelled = 0 AND t.time < ? ORDER BY t.time DESC LIMIT 1) AS t1
            FROM acc
          ),
          pick AS (
            SELECT top.*,
                   (SELECT COUNT(*) FROM transactions t WHERE t.account_id = top.id AND t.is_cancelled = 0 AND t.time = top.t1) AS n1,
                   (SELECT t.balance FROM transactions t WHERE t.account_id = top.id AND t.is_cancelled = 0 AND t.time = top.t1) AS b1
            FROM top
          )
          SELECT id, CASE WHEN n1 = 1 AND b1 IS NOT NULL THEN b1
                          ELSE balance - (SELECT COALESCE(SUM(t.amount), 0) FROM transactions t
                                          WHERE t.account_id = pick.id AND t.is_cancelled = 0 AND t.time >= ? AND t.time <= pick.upd)
                     END AS at_end
          FROM pick`,
    args: [...asked.flatMap((r) => [r.id, r.balance, r.updatedAt]), endSec, endSec],
  });
  return new Map(rs.rows.map((r) => [String(r.id), Number(r.at_end)]));
}

/** Date (in `timeZone`, Kyiv by default) of the oldest covered second over every enabled account; null — nothing imported. */
export async function firstDataDate(db: Db, timeZone: string = TIMEZONE): Promise<string | null> {
  const rs = await db.execute(`SELECT MIN(oldest_synced_time) AS t FROM sync_state WHERE account_id IN (${ENABLED_ACCOUNT_IDS_SQL})`);
  const t = rs.rows[0]?.t;
  return t === null || t === undefined ? null : dateIn(Number(t), timeZone);
}

// ---------- getSyncStatus ----------

export type AccountSyncStatus = {
  id: string;
  label: string;
  imported: boolean;
  /** Kyiv dates of the fully covered range; null if never imported. */
  covered_from: string | null;
  covered_to: string | null;
  last_sync_at: string | null;
  hours_since_sync: number | null;
};

export type SyncStatus = {
  accounts: AccountSyncStatus[];
  /** Date up to which every imported account is covered — periods ending later are incomplete. */
  data_until: string | null;
  last_sync_at: string | null;
  /** Kyiv date-time when the bank allows the next request (the latest of all connections); null = now. */
  next_request_at: string | null;
  diagnostics: {
    transfer_rules: TransferDiagnostics['byRule'];
    unpaired_service_4829: number;
    refund_pairs: number;
    /** Holds from the last 3 days (older ones are final). */
    pending_holds: number;
    scope: Record<Scope, number>;
  };
};

export async function getSyncStatus(db: Db, nowMs: number): Promise<SyncStatus> {
  const { rows, labels } = await loadAccounts(db);
  const accounts = rows
    .map((r) => ({
      id: r.id,
      label: labels.get(r.id) ?? r.id,
      imported: r.synced && r.oldest !== null,
      covered_from: r.oldest === null ? null : toKyivDate(r.oldest),
      covered_to: r.newest === null ? null : toKyivDate(r.newest),
      last_sync_at: r.lastSyncAt === null ? null : toKyivDateTime(r.lastSyncAt),
      hours_since_sync: r.lastSyncAt === null ? null : Math.floor((nowMs / 1000 - r.lastSyncAt) / 3600),
    }));
  // How far the data reaches: the live accounts only (a statement file never holds the token connections back).
  const live = await db.execute(`SELECT MIN(newest_synced_time) AS newest FROM sync_state WHERE account_id IN (${LIVE_ACCOUNT_IDS_SQL})`);
  const liveNewest = live.rows[0]?.newest === null || live.rows[0]?.newest === undefined ? null : Number(live.rows[0].newest);
  const lastSync = rows.filter((r) => r.lastSyncAt !== null).map((r) => r.lastSyncAt!);

  // Each connection has its own slot, with its provider's interval; calls without a connection get the longest one.
  const api = await db.execute(
    `SELECT c.provider, MAX(k.called_at) AS last FROM api_calls k LEFT JOIN connections c ON c.id = k.connection_id
     GROUP BY k.connection_id`,
  );
  const longest = Math.max(...TOKEN_PROVIDER_IDS.map((p) => apiOf(p).requestIntervalMs));
  const frees = api.rows.map(
    (r) => Number(r.last) + (r.provider === null ? longest : apiOf(parseProviderId(r.provider)).requestIntervalMs),
  );
  const nextMs = frees.length === 0 ? null : Math.max(...frees);

  const d = await transferDiagnostics(db);
  // Only holds a sync can still update (last 3 days); older ones are final.
  const holds = await db.execute({
    sql: `SELECT COUNT(*) AS n FROM transactions WHERE is_cancelled = 0 AND hold = 1 AND time >= ? AND account_id IN (${ENABLED_ACCOUNT_IDS_SQL})`,
    args: [Math.floor(nowMs / 1000) - RESYNC_OVERLAP_SEC],
  });
  return {
    accounts,
    data_until: liveNewest === null ? null : toKyivDate(liveNewest),
    last_sync_at: lastSync.length > 0 ? toKyivDateTime(Math.max(...lastSync)) : null,
    next_request_at: nextMs !== null && nextMs > nowMs ? toKyivDateTime(Math.ceil(nextMs / 1000)) : null,
    diagnostics: {
      transfer_rules: d.byRule,
      unpaired_service_4829: d.unpairedService4829,
      refund_pairs: d.refundPairs,
      pending_holds: Number(holds.rows[0]?.n ?? 0),
      scope: await scopeCounts(db),
    },
  };
}
