// Balances and sync status — the phase 5 getBalances / getSyncStatus tools. No card numbers, IBANs or jar titles:
// accounts are identified by id and a "type/CUR" label.
import type { Db } from './db.ts';
import { accountLabels, toKyivDate, toKyivDateTime } from './format.ts';
import { RATE_LIMIT_MS, RESYNC_OVERLAP_SEC } from './constants.ts';
import { transferDiagnostics, type TransferDiagnostics } from './queries.ts';
import { scopeCounts, type Scope } from './scope.ts';

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

async function loadAccounts(db: Db): Promise<{ rows: AccountRow[]; labels: Map<string, string> }> {
  const rs = await db.execute(
    `SELECT a.id, a.kind, a.type, a.currency_code, a.balance, a.credit_limit, a.updated_at,
            s.account_id IS NOT NULL AS synced, s.oldest_synced_time, s.newest_synced_time, s.last_sync_at
     FROM accounts a LEFT JOIN sync_state s ON s.account_id = a.id
     ORDER BY a.kind = 'jar', a.currency_code, a.id`,
  );
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
  }));
  return { rows, labels: accountLabels(rows.map((r) => ({ id: r.id, kind: r.kind, type: r.type, currencyCode: r.currency }))) };
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

/** Cards, plus jars with a positive balance or a sync history (same rule as the sync selection). Minor units. */
export async function getBalances(db: Db): Promise<Balances> {
  const { rows, labels } = await loadAccounts(db);
  const accounts = rows
    .filter((r) => r.kind === 'card' || r.balance > 0 || r.synced)
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
  /** Kyiv date-time when Monobank allows the next request; null = now. */
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
    .filter((r) => r.kind === 'card' || r.balance > 0 || r.synced)
    .map((r) => ({
      id: r.id,
      label: labels.get(r.id) ?? r.id,
      imported: r.synced && r.oldest !== null,
      covered_from: r.oldest === null ? null : toKyivDate(r.oldest),
      covered_to: r.newest === null ? null : toKyivDate(r.newest),
      last_sync_at: r.lastSyncAt === null ? null : toKyivDateTime(r.lastSyncAt),
      hours_since_sync: r.lastSyncAt === null ? null : Math.floor((nowMs / 1000 - r.lastSyncAt) / 3600),
    }));
  const newest = rows.filter((r) => r.newest !== null).map((r) => r.newest!);
  const lastSync = rows.filter((r) => r.lastSyncAt !== null).map((r) => r.lastSyncAt!);

  const api = await db.execute('SELECT MAX(called_at) AS last FROM api_calls');
  const lastCall = api.rows[0]?.last === null || api.rows[0]?.last === undefined ? null : Number(api.rows[0].last);
  const nextMs = lastCall === null ? null : lastCall + RATE_LIMIT_MS;

  const d = await transferDiagnostics(db);
  // Only holds a sync can still update (last 3 days); older ones are final.
  const holds = await db.execute({
    sql: 'SELECT COUNT(*) AS n FROM transactions WHERE is_cancelled = 0 AND hold = 1 AND time >= ?',
    args: [Math.floor(nowMs / 1000) - RESYNC_OVERLAP_SEC],
  });
  return {
    accounts,
    data_until: newest.length > 0 ? toKyivDate(Math.min(...newest)) : null,
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
