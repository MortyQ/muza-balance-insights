// Pure helpers of home's «Insights» block in main (DataService.spendingOverview): a category's lines grouped by payee
// and month, the input of core's `mainDriver`.
import type { PayeeMonths } from '@mono/core/read/insights';
import { merchantKey } from './category.ts';

/** One counted line: its month (YYYY-MM), the payee's text as the screen shows it, hryvnia kopecks (< 0 spending). */
export type PayeeLine = { month: string; merchant: string; uah: number | null };

/**
 * Net spent per payee in the shown month and in each of `months` (0 where none), named by the most frequent spelling.
 * Lines without a rate or a description count nowhere: they cannot be named.
 */
export function payeeMonths(lines: ReadonlyArray<PayeeLine>, shown: string, months: ReadonlyArray<string>): PayeeMonths[] {
  const at = new Map(months.map((m, i) => [m, i]));
  const byKey = new Map<string, { now: number; months: number[]; spellings: Map<string, number> }>();
  for (const l of lines) {
    if (l.uah === null || !l.merchant) continue;
    const i = at.get(l.month);
    if (l.month !== shown && i === undefined) continue;
    const key = merchantKey(l.merchant);
    const p = byKey.get(key) ?? { now: 0, months: months.map(() => 0), spellings: new Map() };
    if (i === undefined) p.now -= l.uah;
    else p.months[i]! -= l.uah;
    p.spellings.set(l.merchant, (p.spellings.get(l.merchant) ?? 0) + 1);
    byKey.set(key, p);
  }
  return [...byKey.values()].map((p) => ({
    name: [...p.spellings].sort(([a, x], [b, y]) => y - x || a.localeCompare(b))[0]![0],
    now: p.now,
    months: p.months,
  }));
}
