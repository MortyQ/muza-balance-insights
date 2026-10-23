// «Usual» spending for the spending block: per category, the median of whole months over the last USUAL_MONTHS fully
// covered months before the shown one. Pure: DataService.spendingOverview gathers the sums.
import { addMonths } from '../shared/analytics.ts';
import { median } from './now.ts';

/** How many months back the usual looks at, and how many of them it needs. */
export const USUAL_MONTHS = 6;
export const USUAL_MIN_MONTHS = 3;

/** The months before `month` (newest first, up to USUAL_MONTHS) that the data covers from their first day. */
export function usualMonths(month: string, dataFrom: string | null): string[] {
  if (dataFrom === null) return [];
  return Array.from({ length: USUAL_MONTHS }, (_, i) => addMonths(month, -(i + 1))).filter((m) => `${m}-01` >= dataFrom);
}

/**
 * The median per category and of the totals over the months' sums (a category missing in a month is 0 there); null
 * with fewer than USUAL_MIN_MONTHS months.
 */
export function usualOf(months: ReadonlyArray<ReadonlyMap<string, number>>): { total: number; byCategory: Map<string, number> } | null {
  if (months.length < USUAL_MIN_MONTHS) return null;
  const categories = new Set(months.flatMap((m) => [...m.keys()]));
  const byCategory = new Map<string, number>();
  for (const c of categories) {
    const u = median(months.map((m) => m.get(c) ?? 0));
    if (u > 0) byCategory.set(c, u);
  }
  const total = median(months.map((m) => [...m.values()].reduce((s, v) => s + v, 0)));
  return { total, byCategory };
}
