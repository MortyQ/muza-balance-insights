// What every summary shares: the period and its coverage, the filters (scope, account, participant) and the SQL
// pieces that decide which rows a view counts. Periods are calendar days [from, to], inclusive, of a time zone
// (periods.ts; Kyiv by default), matched by `time`.
import { ENABLED_ACCOUNT_IDS_SQL, LIVE_ACCOUNT_IDS_SQL } from '../people/accounts.ts';
import { RESYNC_OVERLAP_SEC } from '../shared/constants.ts';
import type { Db } from '../storage/db.ts';
import { accountLabels, dateIn, parseLocalDate } from '../shared/format.ts';
import {
  addDays,
  isTimeZone,
  periodArgs,
  periodRange,
  periodSql,
  zoneOf,
  type ZonedPeriod,
} from '../shared/periods.ts';
import { isScope, type Scope } from '../derive/scope.ts';

export class SummaryError extends Error {
  override name = 'SummaryError';
}

// ---------- periods ----------

export type Period = ZonedPeriod;

export type PeriodInfo = Period & {
  /** Calendar days in [from, to]. */
  days: number;
  /**
   * True if the period ends after the last sync (or in the future): the numbers will still grow.
   * "Last sync" = the least recent newest_synced_time over the live accounts (LIVE_ACCOUNT_IDS_SQL: token connections
   * first; a statement file never holds them back).
   */
  incomplete: boolean;
  /** Date of that last sync in the period's zone; null if nothing was ever synced. That day is usually only partly covered. */
  dataUntil: string | null;
  /**
   * Fully covered days of the period: from … min(to, last complete day before the sync), inclusive.
   * The divisor for averages, so a sync at 00:16 does not count a nearly empty day.
   */
  coveredDays: number;
  /**
   * Holds inside the period that may still change: only those from the last RESYNC_OVERLAP_SEC (3 days) —
   * the window a sync re-reads. Older holds are final: the API keeps some flagged forever and nothing re-reads them.
   */
  pendingHolds: number;
};

function daysBetween(from: string, to: string): number {
  const a = parseLocalDate(from)!;
  const b = parseLocalDate(to)!;
  return Math.round((Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d)) / 86_400_000) + 1;
}

export function validatePeriod(p: Period): Period {
  for (const d of [p.from, p.to]) {
    if (!parseLocalDate(d)) throw new SummaryError(`Некорректная дата «${d}», ожидается YYYY-MM-DD`);
  }
  if (p.from > p.to) throw new SummaryError(`Начало периода ${p.from} позже конца ${p.to}`);
  if (p.tz !== undefined && !isTimeZone(p.tz)) throw new SummaryError(`Неизвестный часовой пояс «${p.tz}»`);
  return p;
}

export async function periodInfo(db: Db, period: Period, nowSec: number): Promise<PeriodInfo> {
  const { from, to } = validatePeriod(period);
  const tz = zoneOf(period);
  const rs = await db.execute(`SELECT MIN(newest_synced_time) AS newest FROM sync_state WHERE account_id IN (${LIVE_ACCOUNT_IDS_SQL})`);
  const newest = rs.rows[0]?.newest === null || rs.rows[0]?.newest === undefined ? null : Number(rs.rows[0].newest);
  const { endSec } = periodRange(period); // exclusive end of the period
  const dataUntil = newest === null ? null : dateIn(newest, tz);
  // A day is complete once its last second is synced: newest + 1 s falls on the next day.
  const lastFullDay = newest === null ? null : addDays(dateIn(newest + 1, tz), -1);
  const lastCovered = lastFullDay === null ? null : lastFullDay < to ? lastFullDay : to;
  const holds = await db.execute({
    sql: `SELECT COUNT(*) AS n FROM transactions
          WHERE is_cancelled = 0 AND hold = 1 AND ${periodSql('transactions')} AND time >= ?
            AND account_id IN (${ENABLED_ACCOUNT_IDS_SQL})`,
    args: [...periodArgs(period), nowSec - RESYNC_OVERLAP_SEC],
  });
  return {
    from,
    to,
    days: daysBetween(from, to),
    incomplete: newest === null || endSec > newest || endSec > nowSec,
    dataUntil,
    coveredDays: lastCovered === null || lastCovered < from ? 0 : daysBetween(from, lastCovered),
    pendingHolds: Number(holds.rows[0]?.n ?? 0),
  };
}

/** Integer minor units per covered day, rounded; null if no day is covered. */
export function perDay(amount: number, info: PeriodInfo): number | null {
  return info.coveredDays > 0 ? Math.round(amount / info.coveredDays) : null;
}

/**
 * participantId: the view of one participant — only their accounts, and a family transfer counts (spending of the
 * sender, income of the receiver). Absent: the whole family — family transfers are excluded like internal ones.
 */
export type Filters = { scope?: Scope; accountId?: string; participantId?: number };

/** WHERE parts for the accounts in view (rows of t): enabled ones only (accounts.ts), of the participant if one is asked for. */
export function accountWhere(f: Filters, where: string[], args: Array<string | number>): void {
  where.push(`t.account_id IN (${ENABLED_ACCOUNT_IDS_SQL})`);
  if (f.participantId === undefined) return;
  where.push('t.account_id IN (SELECT pa.id FROM accounts pa JOIN connections pc ON pc.id = pa.connection_id WHERE pc.participant_id = ?)');
  args.push(f.participantId);
}

/**
 * SQL: this row is not spending / income in the view — internal always, family only for the whole family; never a row
 * that crosses to a disabled account (crossing_category is set, derived.ts: such a row is an ordinary operation).
 */
// COALESCE: transfer_rule is NULL for most rows, and «0 OR NULL» is NULL, not 0.
export const excludedTransferSql = (personView: boolean) =>
  `(t.crossing_category IS NULL AND ${personView ? '(t.is_internal_transfer = 1)' : `(t.is_internal_transfer = 1 OR COALESCE(t.transfer_rule, '') = 'family')`})`;

/**
 * The participant view's rules (family transfers count) — for one participant, or for every one at once when grouped
 * by participant: each row belongs to the participant who owns its account, so each group is that participant's view.
 */
export const personView = (q: Filters & { groupBy?: string }) => q.participantId !== undefined || q.groupBy === 'participant';

/** Rows crossing to a disabled account get their ordinary category (derived.ts). */
export const CATEGORY_SQL = 'COALESCE(t.crossing_category, t.category)';

/** Spending filters also accept the operation currency (ISO numeric), e.g. 8 = ALL for a trip to Albania. */
export type SpendingFilters = Filters & { operationCurrency?: number };

export function validateFilters(f: Filters): void {
  if (f.scope !== undefined && !isScope(f.scope)) throw new SummaryError(`scope: personal или business, получено «${String(f.scope)}»`);
  if (f.participantId !== undefined && !Number.isInteger(f.participantId)) throw new SummaryError('participant: id участника (целое число)');
}

export async function labelsById(db: Db): Promise<Map<string, string>> {
  const rs = await db.execute('SELECT id, kind, type, currency_code FROM accounts');
  return accountLabels(
    rs.rows.map((r) => ({ id: String(r.id), kind: String(r.kind), type: r.type === null ? null : String(r.type), currencyCode: Number(r.currency_code) })),
  );
}
