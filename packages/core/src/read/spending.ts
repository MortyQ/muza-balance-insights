// Spending aggregates over the real database: spendingSummary, spendingGrid and the lines behind them. Amounts are
// minor units of the ACCOUNT currency; different currencies are never summed. No counterparty names or descriptions.
import { CATEGORY } from '../derive/categories.ts';
import type { Db } from '../storage/db.ts';
import { currencyAlpha } from '../shared/currency.ts';
import { BUCKETS_CTE, periodArgs, periodBuckets, periodSql } from '../shared/periods.ts';
import {
  accountWhere,
  CATEGORY_SQL,
  excludedTransferSql,
  labelsById,
  perDay,
  periodInfo,
  personView,
  SummaryError,
  validateFilters,
  type Period,
  type PeriodInfo,
  type SpendingFilters,
} from './filters.ts';

/** The MCP tools' choices (`spending_summary`, `compare_periods`). */
export const SPENDING_GROUP_BY = ['category', 'month', 'account', 'mcc', 'scope', 'operation_currency'] as const;
/**
 * Plus, for the desktop only (the MCP tools do not offer them): `day` — one group per day of the period's zone; and
 * `participant` — one group per participant (the key is the id), each with the participant view's rules (personView).
 */
export type SpendingGroupBy = (typeof SPENDING_GROUP_BY)[number] | 'day' | 'participant';
const GROUP_BY: ReadonlyArray<SpendingGroupBy> = [...SPENDING_GROUP_BY, 'day', 'participant'];

/** Key of the commission line when grouping by MCC (it has no MCC of its own). */
export const COMMISSION_KEY = 'commission';

/** The same lines in the operation currency — only when all of a group's lines share one operation currency. */
export type OperationAmounts = { currency: number; gross: number; refunds: number; net: number };

export type SpendingGroup = {
  /** Account currency: what was actually debited. */
  currency: number;
  /**
   * Category / YYYY-MM / account id / MCC (as text, «commission» for commissions) / scope /
   * operation currency (ISO alphabetic, «commission» for commissions) / participant id.
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
  month: 'bucket',
  account: 'account_id',
  mcc: `COALESCE(CAST(mcc AS TEXT), '${COMMISSION_KEY}')`,
  scope: 'scope',
  operation_currency: `COALESCE(CAST(op_currency AS TEXT), '${COMMISSION_KEY}')`,
  day: 'bucket',
  participant: 'participant_id',
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
 * `lines`: id, kind, currency, account_id, time, mcc, scope, category, amount, op_currency, op_amount, bucket,
 * participant_id (the account owner's, only when grouped by participant, else NULL). The caller
 * keeps SPENDING_LINE_SQL. With `unit`, `bucket` is the row's day or month of the period's zone (the key of the CTE
 * `buckets`), else NULL. The buckets are the outer loop of a range join (CROSS JOIN fixes the order), so each one is an
 * index range on `time` (idx_tx_time: per account it would be one seek per account and bucket) and no row looks its
 * bucket up among all of them. `base` is MATERIALIZED: `lines` reads it
 * twice (bodies and commissions), and inlined twice the second copy got an automatic index over all operations.
 */
export async function spendingLinesSql(
  db: Db,
  q: Period & SpendingFilters & { groupBy?: SpendingGroupBy },
  unit: 'day' | 'month' | null = null,
): Promise<{ sql: string; args: Array<string | number> }> {
  // With buckets the period is their union, and only their bounds may reach the time index: given the period's bounds
  // too, SQLite takes those, and every bucket walks the whole period.
  const where = unit ? ['t.is_cancelled = 0'] : ['t.is_cancelled = 0', periodSql('t')];
  const args: Array<string | number> = unit ? [] : [...periodArgs(q)];
  if (q.scope) (where.push('t.scope = ?'), args.push(q.scope));
  if (q.accountId) (where.push('t.account_id = ?'), args.push(q.accountId));
  if (q.operationCurrency !== undefined) (where.push('t.currency_code = ?'), args.push(q.operationCurrency));
  accountWhere(q, where, args);
  const byPerson = q.groupBy === 'participant';
  return {
    sql: `WITH ${unit ? `${BUCKETS_CTE},` : ''}
          base AS MATERIALIZED (
            SELECT t.id, a.currency_code AS currency, t.account_id, t.time, t.mcc, t.scope, ${CATEGORY_SQL} AS category,
                   ${excludedTransferSql(personView(q))} AS internal, t.amount, t.currency_code AS op_currency,
                   COALESCE(t.operation_amount, CASE WHEN t.currency_code = a.currency_code THEN t.amount END) AS op_amount,
                   CASE WHEN t.amount < 0 THEN COALESCE(t.commission_rate, 0) ELSE 0 END AS commission,
                   ${unit ? 'b.k' : 'NULL'} AS bucket, ${byPerson ? 'c.participant_id' : 'NULL'} AS participant_id
            FROM ${unit ? 'buckets b CROSS JOIN transactions t INDEXED BY idx_tx_time ON t.time >= b.s AND t.time < b.e' : 'transactions t'}
              JOIN accounts a ON a.id = t.account_id${byPerson ? ' JOIN connections c ON c.id = a.connection_id' : ''}
            WHERE ${where.join(' AND ')}
          ),
          lines AS (
            -- body: account-currency amount without the commission; the operation amount never includes it
            SELECT id, 'body' AS kind, currency, account_id, time, mcc, scope, category, amount + commission AS amount, op_currency, op_amount, bucket, participant_id
            FROM base WHERE internal = 0
            UNION ALL
            -- commission: account currency only, no operation currency
            SELECT id, 'commission', currency, account_id, time, NULL, scope, ?, -commission, NULL, NULL, bucket, participant_id FROM base WHERE commission > 0
          )`,
    args: [...(unit ? [periodBuckets(q, unit)] : []), ...args, CATEGORY.fees],
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

/** One cell of spendingGrid: one account currency, one day (YYYY-MM-DD) or month (YYYY-MM) of the period's zone, one category. */
export type SpendingCell = { currency: number; bucket: string; category: string; purchases: number; gross: number; refunds: number; net: number };
export type SpendingGrid = { period: PeriodInfo; unit: 'day' | 'month'; cells: SpendingCell[] };

/**
 * Spending by category × day or month of the period's zone in one query, over the lines of spendingSummary
 * (spendingLinesSql + SPENDING_LINE_SQL): per currency the cells add up to its groups by category, day or month.
 * For the desktop's analytics screen; the MCP tools do not offer it.
 */
export async function spendingGrid(db: Db, q: Period & SpendingFilters & { unit: 'day' | 'month' }, nowSec: number): Promise<SpendingGrid> {
  if (q.unit !== 'day' && q.unit !== 'month') throw new SummaryError(`unit: day | month, получено «${String(q.unit)}»`);
  validateFilters(q);
  const period = await periodInfo(db, q, nowSec);
  const from = await spendingLinesSql(db, q, q.unit);
  const rs = await db.execute({
    sql: `${from.sql}
          SELECT currency, bucket AS b, category,
                 SUM(CASE WHEN amount < 0 THEN 1 ELSE 0 END) AS purchases,
                 SUM(CASE WHEN amount < 0 THEN -amount ELSE 0 END) AS gross,
                 SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) AS refunds
          FROM lines
          WHERE ${SPENDING_LINE_SQL}
          GROUP BY currency, b, category
          ORDER BY currency, b, category`,
    args: [...from.args, ...SPENDING_LINE_ARGS],
  });
  const cells = rs.rows.map((r) => {
    const gross = Number(r.gross);
    const refunds = Number(r.refunds);
    return { currency: Number(r.currency), bucket: String(r.b), category: String(r.category), purchases: Number(r.purchases), gross, refunds, net: gross - refunds };
  });
  return { period, unit: q.unit, cells };
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
