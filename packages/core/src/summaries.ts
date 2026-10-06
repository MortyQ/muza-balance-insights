// Spending / income aggregates over the real database — the core of the phase 5 MCP tools.
// All amounts are minor units of the ACCOUNT currency; different currencies are never summed.
// Periods are calendar days [from, to], inclusive, of a time zone (periods.ts; Kyiv by default), matched by `time`. No counterparty names or descriptions in any output.
import { CROSSING_CTE, CROSSING_JOIN, ENABLED_ACCOUNT_IDS_SQL, crossingCategories } from './accounts.ts';
import { CATEGORY } from './categories.ts';
import { RESYNC_OVERLAP_SEC } from './constants.ts';
import type { Db } from './db.ts';
import { currencyAlpha } from './currency.ts';
import { accountLabels, dateIn, parseLocalDate } from './format.ts';
import { BUCKETS_CTE, addDays, bucketKeySql, isTimeZone, periodArgs, periodBuckets, periodRange, periodSql, zoneOf, type ZonedPeriod } from './periods.ts';
import { accountProviders, providerOf } from './connections.ts';
import { rulesFor } from './providers/rules.ts';
import type { ProviderId, ProviderIncomeSource } from './providers/types.ts';
import { isScope, type Scope } from './scope.ts';

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
   * "Last sync" = the least recent newest_synced_time over synced accounts, so no account is ahead of it.
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
  const rs = await db.execute(`SELECT MIN(newest_synced_time) AS newest FROM sync_state WHERE account_id IN (${ENABLED_ACCOUNT_IDS_SQL})`);
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
function perDay(amount: number, info: PeriodInfo): number | null {
  return info.coveredDays > 0 ? Math.round(amount / info.coveredDays) : null;
}

/**
 * participantId: the view of one participant — only their accounts, and a family transfer counts (spending of the
 * sender, income of the receiver). Absent: the whole family — family transfers are excluded like internal ones.
 */
export type Filters = { scope?: Scope; accountId?: string; participantId?: number };

/** WHERE parts for the accounts in view (rows of t): enabled ones only (accounts.ts), of the participant if one is asked for. */
function accountWhere(f: Filters, where: string[], args: Array<string | number>): void {
  where.push(`t.account_id IN (${ENABLED_ACCOUNT_IDS_SQL})`);
  if (f.participantId === undefined) return;
  where.push('t.account_id IN (SELECT pa.id FROM accounts pa JOIN connections pc ON pc.id = pa.connection_id WHERE pc.participant_id = ?)');
  args.push(f.participantId);
}

/**
 * SQL: this row is not spending / income in the view — internal always, family only for the whole family; never a row
 * that crosses to a disabled account (x = the crossingCategories join: such a row is an ordinary operation).
 */
// COALESCE: transfer_rule is NULL for most rows, and «0 OR NULL» is NULL, not 0.
const excludedTransferSql = (f: Filters) =>
  `(x.key IS NULL AND ${f.participantId === undefined ? `(t.is_internal_transfer = 1 OR COALESCE(t.transfer_rule, '') = 'family')` : '(t.is_internal_transfer = 1)'})`;

/** Rows crossing to a disabled account get their ordinary category (accounts.ts crossingCategories). */
const CATEGORY_SQL = 'COALESCE(x.value, t.category)';

/** Spending filters also accept the operation currency (ISO numeric), e.g. 8 = ALL for a trip to Albania. */
export type SpendingFilters = Filters & { operationCurrency?: number };

export function validateFilters(f: Filters): void {
  if (f.scope !== undefined && !isScope(f.scope)) throw new SummaryError(`scope: personal или business, получено «${String(f.scope)}»`);
  if (f.participantId !== undefined && !Number.isInteger(f.participantId)) throw new SummaryError('participant: id участника (целое число)');
}

async function labelsById(db: Db): Promise<Map<string, string>> {
  const rs = await db.execute('SELECT id, kind, type, currency_code FROM accounts');
  return accountLabels(
    rs.rows.map((r) => ({ id: String(r.id), kind: String(r.kind), type: r.type === null ? null : String(r.type), currencyCode: Number(r.currency_code) })),
  );
}

// ---------- spendingSummary ----------

/** The MCP tools' choices (`spending_summary`, `compare_periods`). */
export const SPENDING_GROUP_BY = ['category', 'month', 'account', 'mcc', 'scope', 'operation_currency'] as const;
/** Plus `day` — one group per day of the period's zone — for the desktop's «Now» strip only: the MCP tools do not offer it. */
export type SpendingGroupBy = (typeof SPENDING_GROUP_BY)[number] | 'day';
const GROUP_BY: ReadonlyArray<SpendingGroupBy> = [...SPENDING_GROUP_BY, 'day'];

/** Key of the commission line when grouping by MCC (it has no MCC of its own). */
export const COMMISSION_KEY = 'commission';

/** The same lines in the operation currency — only when all of a group's lines share one operation currency. */
export type OperationAmounts = { currency: number; gross: number; refunds: number; net: number };

export type SpendingGroup = {
  /** Account currency: what was actually debited. */
  currency: number;
  /**
   * Category / YYYY-MM / account id / MCC (as text, «commission» for commissions) / scope /
   * operation currency (ISO alphabetic, «commission» for commissions).
   */
  key: string;
  /** Only for groupBy = account: "black/UAH". */
  label?: string;
  /** Ledger lines: a row with a commission counts as two lines (body + commission). */
  lines: number;
  /** Spending lines (amount < 0): a refund is not an operation; a commission is a line of its own. */
  purchases: number;
  /** All ≥ 0. net = gross − refunds. */
  gross: number;
  refunds: number;
  net: number;
  netPerDay: number | null;
  operation?: OperationAmounts;
};

export type CurrencyTotal = {
  currency: number;
  lines: number;
  purchases: number;
  gross: number;
  refunds: number;
  net: number;
  netPerDay: number | null;
  operation?: OperationAmounts;
};

export type SpendingSummary = {
  period: PeriodInfo;
  groupBy: SpendingGroupBy;
  filters: SpendingFilters & { category?: string };
  groups: SpendingGroup[];
  /** Per account currency, never across currencies. */
  totals: CurrencyTotal[];
};

export type SpendingQuery = Period & SpendingFilters & { groupBy?: SpendingGroupBy; category?: string };

const KEY_SQL: Record<SpendingGroupBy, string> = {
  category: 'category',
  month: bucketKeySql('time'),
  account: 'account_id',
  mcc: `COALESCE(CAST(mcc AS TEXT), '${COMMISSION_KEY}')`,
  scope: 'scope',
  operation_currency: `COALESCE(CAST(op_currency AS TEXT), '${COMMISSION_KEY}')`,
  day: bucketKeySql('time'),
};

/** Lines that count as spending: not «поступления» / «свои переводы», not zero. Arguments: SPENDING_LINE_ARGS. */
export const SPENDING_LINE_SQL = 'category NOT IN (?, ?) AND amount <> 0';
export const SPENDING_LINE_ARGS: readonly string[] = [CATEGORY.income, CATEGORY.ownTransfers];

/**
 * `WITH … base, lines` of a spending query — the one place the line rules live (spendingSummary, categoryLines):
 * - a row with commission_rate > 0 (amount < 0) is split: the body (`kind` body, amount + commission) keeps its
 *   category, the commission is a separate «комиссии банка» line (`kind` commission, no operation currency);
 * - internal transfers (and family ones when the whole family is viewed): the body is excluded, the commission stays;
 * - only enabled accounts (accounts.ts); a transfer to or from a disabled one is an ordinary operation.
 * `lines`: id, kind, currency, account_id, time, mcc, scope, category, amount, op_currency, op_amount. The caller keeps
 * SPENDING_LINE_SQL. With `unit`, the CTE `buckets` of the period's days or months is there too (bucketKeySql).
 */
export async function spendingLinesSql(
  db: Db,
  q: Period & SpendingFilters,
  unit: 'day' | 'month' | null = null,
): Promise<{ sql: string; args: Array<string | number> }> {
  const where = ['t.is_cancelled = 0', periodSql('t')];
  const args: Array<string | number> = [...periodArgs(q)];
  if (q.scope) (where.push('t.scope = ?'), args.push(q.scope));
  if (q.accountId) (where.push('t.account_id = ?'), args.push(q.accountId));
  if (q.operationCurrency !== undefined) (where.push('t.currency_code = ?'), args.push(q.operationCurrency));
  accountWhere(q, where, args);
  return {
    sql: `WITH ${CROSSING_CTE},${unit ? ` ${BUCKETS_CTE},` : ''}
          base AS (
            SELECT t.id, a.currency_code AS currency, t.account_id, t.time, t.mcc, t.scope, ${CATEGORY_SQL} AS category,
                   ${excludedTransferSql(q)} AS internal, t.amount, t.currency_code AS op_currency,
                   COALESCE(t.operation_amount, CASE WHEN t.currency_code = a.currency_code THEN t.amount END) AS op_amount,
                   CASE WHEN t.amount < 0 THEN COALESCE(t.commission_rate, 0) ELSE 0 END AS commission
            FROM transactions t JOIN accounts a ON a.id = t.account_id ${CROSSING_JOIN}
            WHERE ${where.join(' AND ')}
          ),
          lines AS (
            -- body: account-currency amount without the commission; the operation amount never includes it
            SELECT id, 'body' AS kind, currency, account_id, time, mcc, scope, category, amount + commission AS amount, op_currency, op_amount
            FROM base WHERE internal = 0
            UNION ALL
            -- commission: account currency only, no operation currency
            SELECT id, 'commission', currency, account_id, time, NULL, scope, ?, -commission, NULL, NULL FROM base WHERE commission > 0
          )`,
    args: [await crossingCategories(db, q), ...(unit ? [periodBuckets(q, unit)] : []), ...args, CATEGORY.fees],
  };
}

/**
 * Spending for the days [from, to] of the period's zone (by `time`):
 * - a row with commission_rate > 0 (amount < 0) is split: body = amount + commission keeps its category,
 *   the commission is a separate «комиссии банка» line;
 * - internal transfers (and family ones when the whole family is viewed): the body is excluded, the commission stays
 *   spending;
 * - refunds are positive lines in a spending category; «поступления» and «свои переводы» are excluded;
 * - only enabled accounts (accounts.ts); a transfer to or from a disabled one is an ordinary operation.
 * Filters: scope, accountId, participantId, category (applies to lines, so «комиссии банка» works too).
 */
export async function spendingSummary(db: Db, q: SpendingQuery, nowSec: number): Promise<SpendingSummary> {
  const groupBy = q.groupBy ?? 'category';
  if (!GROUP_BY.includes(groupBy)) throw new SummaryError(`groupBy: ${GROUP_BY.join(' | ')}, получено «${String(groupBy)}»`);
  validateFilters(q);
  const period = await periodInfo(db, q, nowSec);

  const outer = [SPENDING_LINE_SQL];
  const outerArgs: string[] = [...SPENDING_LINE_ARGS];
  if (q.category) (outer.push('category = ?'), outerArgs.push(q.category));

  // Day and month keys come from the zone's own day starts (periods.ts): SQLite knows no time zones.
  const unit = groupBy === 'day' ? 'day' : groupBy === 'month' ? 'month' : null;
  const from = await spendingLinesSql(db, q, unit);
  const rs = await db.execute({
    sql: `${from.sql}
          SELECT currency, ${KEY_SQL[groupBy]} AS k, COUNT(*) AS lines,
                 SUM(CASE WHEN amount < 0 THEN 1 ELSE 0 END) AS purchases,
                 SUM(CASE WHEN amount < 0 THEN -amount ELSE 0 END) AS gross,
                 SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) AS refunds,
                 COUNT(DISTINCT op_currency) AS op_currencies, SUM(op_currency IS NULL) AS op_missing, MIN(op_currency) AS op_currency,
                 SUM(CASE WHEN op_amount < 0 THEN -op_amount ELSE 0 END) AS op_gross,
                 SUM(CASE WHEN op_amount > 0 THEN op_amount ELSE 0 END) AS op_refunds
          FROM lines
          WHERE ${outer.join(' AND ')}
          GROUP BY currency, k
          ORDER BY currency, gross DESC, k`,
    args: [...from.args, ...outerArgs],
  });

  const labels = groupBy === 'account' ? await labelsById(db) : null;
  const groups: SpendingGroup[] = rs.rows.map((r) => {
    const gross = Number(r.gross);
    const refunds = Number(r.refunds);
    const rawKey = String(r.k);
    const key = groupBy === 'operation_currency' && rawKey !== COMMISSION_KEY ? currencyAlpha(Number(rawKey)) : rawKey;
    const single = Number(r.op_currencies) === 1 && Number(r.op_missing) === 0;
    const opGross = Number(r.op_gross);
    const opRefunds = Number(r.op_refunds);
    return {
      currency: Number(r.currency),
      key,
      ...(labels ? { label: labels.get(rawKey) ?? rawKey } : {}),
      lines: Number(r.lines),
      purchases: Number(r.purchases),
      gross,
      refunds,
      net: gross - refunds,
      netPerDay: perDay(gross - refunds, period),
      ...(single ? { operation: { currency: Number(r.op_currency), gross: opGross, refunds: opRefunds, net: opGross - opRefunds } } : {}),
    };
  });
  return {
    period,
    groupBy,
    filters: {
      ...(q.scope ? { scope: q.scope } : {}),
      ...(q.accountId ? { accountId: q.accountId } : {}),
      ...(q.operationCurrency !== undefined ? { operationCurrency: q.operationCurrency } : {}),
      ...(q.participantId !== undefined ? { participantId: q.participantId } : {}),
      ...(q.category ? { category: q.category } : {}),
    },
    groups,
    totals: currencyTotals(groups, period),
  };
}

/** Per account currency. The operation block survives only if every group of that currency has one and the same operation currency. */
function currencyTotals(groups: readonly SpendingGroup[], period: PeriodInfo): CurrencyTotal[] {
  const by = new Map<number, CurrencyTotal & { opOk: boolean }>();
  for (const g of groups) {
    const t = by.get(g.currency) ?? { currency: g.currency, lines: 0, purchases: 0, gross: 0, refunds: 0, net: 0, netPerDay: null, opOk: true };
    t.lines += g.lines;
    t.purchases += g.purchases;
    t.gross += g.gross;
    t.refunds += g.refunds;
    t.net += g.net;
    if (!g.operation || (t.operation && t.operation.currency !== g.operation.currency)) t.opOk = false;
    else if (t.opOk) {
      const o = t.operation ?? { currency: g.operation.currency, gross: 0, refunds: 0, net: 0 };
      t.operation = { currency: o.currency, gross: o.gross + g.operation.gross, refunds: o.refunds + g.operation.refunds, net: o.net + g.operation.net };
    }
    by.set(g.currency, t);
  }
  return [...by.values()]
    .sort((a, b) => a.currency - b.currency)
    .map(({ opOk, operation, ...t }) => ({ ...t, netPerDay: perDay(t.net, period), ...(opOk && operation ? { operation } : {}) }));
}

// ---------- comparePeriods ----------

export type CompareRow = {
  currency: number;
  key: string;
  label?: string;
  /** Net spending in period A (the baseline) and B. */
  a: number;
  b: number;
  /** b − a. */
  diff: number;
  /** diff / a × 100, one decimal; null when a = 0. */
  diffPct: number | null;
  /** new = only in B, gone = only in A. */
  status: 'both' | 'new' | 'gone';
};

export type CompareTotal = {
  currency: number;
  a: number;
  b: number;
  diff: number;
  diffPct: number | null;
  /** Per covered day: the fair comparison when the periods differ in length or one is incomplete. */
  aPerDay: number | null;
  bPerDay: number | null;
};

export type PeriodComparison = {
  a: PeriodInfo;
  b: PeriodInfo;
  groupBy: SpendingGroupBy;
  rows: CompareRow[];
  totals: CompareTotal[];
};

const pct = (diff: number, base: number) => (base === 0 ? null : Math.round((diff / base) * 1000) / 10);

/** Net spending of B against A, per group and currency (same rules and filters as spendingSummary). */
export async function comparePeriods(
  db: Db,
  q: { a: Period; b: Period; groupBy?: SpendingGroupBy; category?: string } & SpendingFilters,
  nowSec: number,
): Promise<PeriodComparison> {
  const common = {
    groupBy: q.groupBy, category: q.category, scope: q.scope, accountId: q.accountId, operationCurrency: q.operationCurrency,
    participantId: q.participantId,
  };
  const [sa, sb] = [await spendingSummary(db, { ...q.a, ...common }, nowSec), await spendingSummary(db, { ...q.b, ...common }, nowSec)];

  const rows = new Map<string, CompareRow>();
  const id = (g: SpendingGroup) => `${g.currency}\u0000${g.key}`;
  for (const g of sa.groups) {
    rows.set(id(g), { currency: g.currency, key: g.key, ...(g.label ? { label: g.label } : {}), a: g.net, b: 0, diff: 0, diffPct: null, status: 'gone' });
  }
  for (const g of sb.groups) {
    const r = rows.get(id(g));
    if (r) (r.b = g.net), (r.status = 'both');
    else rows.set(id(g), { currency: g.currency, key: g.key, ...(g.label ? { label: g.label } : {}), a: 0, b: g.net, diff: 0, diffPct: null, status: 'new' });
  }
  const out = [...rows.values()].map((r) => ({ ...r, diff: r.b - r.a, diffPct: pct(r.b - r.a, r.a) }));
  out.sort((x, y) => x.currency - y.currency || Math.abs(y.diff) - Math.abs(x.diff) || (x.key < y.key ? -1 : 1));

  const currencies = [...new Set([...sa.totals, ...sb.totals].map((t) => t.currency))].sort((x, y) => x - y);
  const totals = currencies.map((currency) => {
    const a = sa.totals.find((t) => t.currency === currency);
    const b = sb.totals.find((t) => t.currency === currency);
    const an = a?.net ?? 0;
    const bn = b?.net ?? 0;
    return { currency, a: an, b: bn, diff: bn - an, diffPct: pct(bn - an, an), aPerDay: perDay(an, sa.period), bPerDay: perDay(bn, sb.period) };
  });
  return { a: sa.period, b: sb.period, groupBy: sa.groupBy, rows: out, totals };
}

// ---------- incomeSummary ----------

export const INCOME_GROUP_BY = ['source', 'month', 'account', 'scope'] as const;
export type IncomeGroupBy = (typeof INCOME_GROUP_BY)[number];

/** The provider's sources, plus `family`: money from another participant (participant view only). */
export type IncomeSource = ProviderIncomeSource | 'family';

/** Where a credit came from, by the shape of the operation (never by name) — the provider's rule. */
export function incomeSource(mcc: number, description: string, provider: ProviderId): ProviderIncomeSource {
  // Income rows are credits: the amount only says so.
  return rulesFor(provider).incomeSource({ mcc, description, amount: 1 });
}

export type IncomeGroup = { currency: number; key: string; label?: string; lines: number; total: number; totalPerDay: number | null };
export type IncomeSummary = {
  period: PeriodInfo;
  groupBy: IncomeGroupBy;
  filters: Filters;
  groups: IncomeGroup[];
  totals: Array<{ currency: number; lines: number; total: number; totalPerDay: number | null }>;
};

/**
 * `WITH … SELECT` of the income rows in the period — the one place the income rules live (incomeSummary, incomeLines):
 * non-internal «поступления» rows; family transfers only in a participant's view; only enabled accounts.
 * Columns: id, currency (the account's), account_id, participant_id, time, mcc, scope, description, comment, counter_name,
 * hold, amount, op_currency, op_amount, transfer_rule (null for a row crossing to a disabled account). Newest first.
 */
export async function incomeRowsSql(db: Db, q: Period & Filters): Promise<{ sql: string; args: Array<string | number> }> {
  const where = ['t.is_cancelled = 0', `NOT ${excludedTransferSql(q)}`, `${CATEGORY_SQL} = ?`, periodSql('t')];
  const args: Array<string | number> = [await crossingCategories(db, q), CATEGORY.income, ...periodArgs(q)];
  if (q.scope) (where.push('t.scope = ?'), args.push(q.scope));
  if (q.accountId) (where.push('t.account_id = ?'), args.push(q.accountId));
  accountWhere(q, where, args);
  return {
    sql: `WITH ${CROSSING_CTE}
          SELECT t.id, a.currency_code AS currency, t.account_id, c.participant_id, t.time, t.mcc, t.scope, t.description,
                 t.comment, t.counter_name, t.hold, t.amount, t.currency_code AS op_currency,
                 COALESCE(t.operation_amount, CASE WHEN t.currency_code = a.currency_code THEN t.amount END) AS op_amount,
                 CASE WHEN x.key IS NULL THEN t.transfer_rule END AS transfer_rule
          FROM transactions t JOIN accounts a ON a.id = t.account_id JOIN connections c ON c.id = a.connection_id ${CROSSING_JOIN}
          WHERE ${where.join(' AND ')}
          ORDER BY t.time DESC, t.id`,
    args,
  };
}

/**
 * Income = non-internal rows in «поступления» for the days [from, to] of the period's zone. Refunds are not income
 * (they sit in the purchase's category), internal transfers neither. Cashback is not included.
 * A family transfer is income of the receiver (source `family`) in a participant's view, and not income of the family.
 * Only enabled accounts (accounts.ts); a credit from a disabled one is ordinary income (its own source).
 */
export async function incomeSummary(
  db: Db,
  q: Period & Filters & { groupBy?: IncomeGroupBy },
  nowSec: number,
): Promise<IncomeSummary> {
  const groupBy = q.groupBy ?? 'source';
  if (!INCOME_GROUP_BY.includes(groupBy)) throw new SummaryError(`groupBy: ${INCOME_GROUP_BY.join(' | ')}, получено «${String(groupBy)}»`);
  validateFilters(q);
  const period = await periodInfo(db, q, nowSec);

  const rs = await db.execute(await incomeRowsSql(db, q));

  const labels = groupBy === 'account' ? await labelsById(db) : null;
  const providers = await accountProviders(db);
  const groups = new Map<string, IncomeGroup>();
  for (const r of rs.rows) {
    const key =
      groupBy === 'source'
        ? r.transfer_rule === 'family'
          ? ('family' satisfies IncomeSource)
          : incomeSource(Number(r.mcc), String(r.description ?? ''), providerOf(providers, String(r.account_id)))
      : groupBy === 'month' ? dateIn(Number(r.time), zoneOf(q)).slice(0, 7)
      : groupBy === 'account' ? String(r.account_id)
      : String(r.scope);
    const currency = Number(r.currency);
    const id = `${currency}\u0000${key}`;
    const g = groups.get(id) ?? { currency, key, ...(labels ? { label: labels.get(key) ?? key } : {}), lines: 0, total: 0, totalPerDay: null };
    g.lines += 1;
    g.total += Number(r.amount);
    groups.set(id, g);
  }
  const list = [...groups.values()]
    .map((g) => ({ ...g, totalPerDay: perDay(g.total, period) }))
    .sort((x, y) => x.currency - y.currency || y.total - x.total || (x.key < y.key ? -1 : 1));

  const totals = new Map<number, { currency: number; lines: number; total: number; totalPerDay: number | null }>();
  for (const g of list) {
    const t = totals.get(g.currency) ?? { currency: g.currency, lines: 0, total: 0, totalPerDay: null };
    t.lines += g.lines;
    t.total += g.total;
    totals.set(g.currency, t);
  }
  return {
    period,
    groupBy,
    filters: {
      ...(q.scope ? { scope: q.scope } : {}),
      ...(q.accountId ? { accountId: q.accountId } : {}),
      ...(q.participantId !== undefined ? { participantId: q.participantId } : {}),
    },
    groups: list,
    totals: [...totals.values()].sort((a, b) => a.currency - b.currency).map((t) => ({ ...t, totalPerDay: perDay(t.total, period) })),
  };
}
