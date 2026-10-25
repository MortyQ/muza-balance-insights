// Two periods side by side: comparePeriods over spendingSummary.
import type { Db } from '../storage/db.ts';
import { perDay, type Period, type PeriodInfo, type SpendingFilters } from './filters.ts';
import { spendingSummary, type SpendingGroup, type SpendingGroupBy } from './spending.ts';

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
