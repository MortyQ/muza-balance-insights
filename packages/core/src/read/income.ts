// Income aggregates over the real database: incomeSummary and its rows. Amounts are minor units of the ACCOUNT
// currency; different currencies are never summed. No counterparty names or descriptions.
import { CATEGORY } from '../derive/categories.ts';
import type { Db } from '../storage/db.ts';
import { dateIn } from '../shared/format.ts';
import { periodArgs, periodSql, zoneOf } from '../shared/periods.ts';
import { accountProviders, providerOf } from '../people/connections.ts';
import { rulesFor } from '../providers/rules.ts';
import type { ProviderId, ProviderIncomeSource } from '../providers/types.ts';
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
  type Filters,
  type Period,
  type PeriodInfo,
} from './filters.ts';

export const INCOME_GROUP_BY = ['source', 'month', 'account', 'scope'] as const;
/** Plus `day` and `participant` (as in SpendingGroupBy) for the desktop only: the MCP tools do not offer them. */
export type IncomeGroupBy = (typeof INCOME_GROUP_BY)[number] | 'day' | 'participant';
const INCOME_GROUPS: ReadonlyArray<IncomeGroupBy> = [...INCOME_GROUP_BY, 'day', 'participant'];

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
 * non-internal «поступления» rows; family transfers only in a participant's view (personView); only enabled accounts.
 * Columns: id, currency (the account's), account_id, participant_id, time, mcc, scope, description, comment, counter_name,
 * hold, amount, op_currency, op_amount, transfer_rule (null for a row crossing to a disabled account). Newest first.
 */
export async function incomeRowsSql(db: Db, q: Period & Filters & { groupBy?: IncomeGroupBy }): Promise<{ sql: string; args: Array<string | number> }> {
  const where = ['t.is_cancelled = 0', `NOT ${excludedTransferSql(personView(q))}`, `${CATEGORY_SQL} = ?`, periodSql('t')];
  const args: Array<string | number> = [CATEGORY.income, ...periodArgs(q)];
  if (q.scope) (where.push('t.scope = ?'), args.push(q.scope));
  if (q.accountId) (where.push('t.account_id = ?'), args.push(q.accountId));
  accountWhere(q, where, args);
  return {
    sql: `SELECT t.id, a.currency_code AS currency, t.account_id, c.participant_id, t.time, t.mcc, t.scope, t.description,
                 t.comment, t.counter_name, t.hold, t.amount, t.currency_code AS op_currency,
                 COALESCE(t.operation_amount, CASE WHEN t.currency_code = a.currency_code THEN t.amount END) AS op_amount,
                 CASE WHEN t.crossing_category IS NULL THEN t.transfer_rule END AS transfer_rule
          FROM transactions t JOIN accounts a ON a.id = t.account_id JOIN connections c ON c.id = a.connection_id
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
  if (!INCOME_GROUPS.includes(groupBy)) throw new SummaryError(`groupBy: ${INCOME_GROUPS.join(' | ')}, получено «${String(groupBy)}»`);
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
      : groupBy === 'day' ? dateIn(Number(r.time), zoneOf(q))
      : groupBy === 'month' ? dateIn(Number(r.time), zoneOf(q)).slice(0, 7)
      : groupBy === 'account' ? String(r.account_id)
      : groupBy === 'participant' ? String(r.participant_id)
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
