// Pure helpers of the analytics screen in main (DataService.analyticsOverview): the buckets of a period, the period it is
// compared with, folding account currencies into hryvnia by today's rates, the «usual month» curve.
import { toUah, type FxRate } from '@mono/core/fx';
import type { SpendingCell } from '@mono/core/summaries';
import { addMonths, monthSpan } from '../shared/analytics.ts';
import type { AnalyticsBucketState } from '../shared/api.ts';
import { monthBounds } from './spending.ts';

/** The months from..to, both included, oldest first. */
export function monthsBetween(from: string, to: string): string[] {
  return Array.from({ length: monthSpan(from, to) }, (_, i) => addMonths(from, i));
}

/** The same number of whole months right before `from`, as dates. */
export function previousRange(from: string, to: string): { from: string; to: string } {
  const n = monthSpan(from, to);
  return { from: monthBounds(addMonths(from, -n)).from, to: monthBounds(addMonths(from, -1)).to };
}

/** Every date of a month, YYYY-MM-DD. */
export function daysOf(month: string): string[] {
  const last = Number(monthBounds(month).to.slice(8, 10));
  return Array.from({ length: last }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`);
}

/** A day or a month against today and the first date with data (both in the system time zone). */
export function bucketState(key: string, unit: 'day' | 'month', at: { today: string; dataFrom: string | null }): AnalyticsBucketState {
  const now = unit === 'day' ? at.today : at.today.slice(0, 7);
  const first = at.dataFrom === null ? null : unit === 'day' ? at.dataFrom : at.dataFrom.slice(0, 7);
  if (key > now || first === null || key < first) return 'none';
  return key === now ? 'running' : 'full';
}

/** Per category: hryvnia kopecks per bucket in `keys` order, and purchases; a currency without a rate stays out. */
export function foldCells(
  cells: readonly SpendingCell[],
  keys: readonly string[],
  rates: ReadonlyMap<number, FxRate>,
): { net: Map<string, number[]>; purchases: Map<string, number>; leftOut: Set<number> } {
  const at = new Map(keys.map((k, i) => [k, i]));
  const net = new Map<string, number[]>();
  const purchases = new Map<string, number>();
  const leftOut = new Set<number>();
  for (const c of cells) {
    const i = at.get(c.bucket);
    if (i === undefined) continue;
    const uah = toUah(c.net, c.currency, rates);
    if (uah === null) {
      leftOut.add(c.currency);
      continue;
    }
    const row = net.get(c.category) ?? keys.map(() => 0);
    row[i]! += uah;
    net.set(c.category, row);
    purchases.set(c.category, (purchases.get(c.category) ?? 0) + c.purchases);
  }
  return { net, purchases, leftOut };
}

/** Income groups keyed by bucket → hryvnia kopecks per bucket in `keys` order. */
export function foldIncome(
  groups: ReadonlyArray<{ currency: number; key: string; total: number }>,
  keys: readonly string[],
  rates: ReadonlyMap<number, FxRate>,
): { values: number[]; leftOut: Set<number> } {
  const at = new Map(keys.map((k, i) => [k, i]));
  const values = keys.map(() => 0);
  const leftOut = new Set<number>();
  for (const g of groups) {
    const i = at.get(g.key);
    if (i === undefined) continue;
    const uah = toUah(g.total, g.currency, rates);
    if (uah === null) leftOut.add(g.currency);
    else values[i]! += uah;
  }
  return { values, leftOut };
}

export function runningTotals(values: readonly number[]): number[] {
  let sum = 0;
  return values.map((v) => (sum += v));
}

/** The mean of the months' running totals, `days` long; a shorter month is carried at its last value. Null for no months. */
export function usualCurve(months: ReadonlyArray<readonly number[]>, days: number): number[] | null {
  if (months.length === 0) return null;
  return Array.from({ length: days }, (_, d) => {
    const sum = months.reduce((s, m) => s + (m[Math.min(d, m.length - 1)] ?? 0), 0);
    return Math.round(sum / months.length);
  });
}
