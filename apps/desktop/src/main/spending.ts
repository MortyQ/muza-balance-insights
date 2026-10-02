// Pure helpers of the spending block in main (DataService.spendingOverview): the period compared with, and folding
// account currencies into hryvnia by the user's own exchange rates.
import { toUah, type FxRate } from '@mono/core/fx';
import type { PeriodInfo, SpendingSummary } from '@mono/core/summaries';
import type { SpendingAmounts } from '../shared/api.ts';

const pad2 = (n: number) => String(n).padStart(2, '0');

function bounds(month: string): { from: string; to: string } {
  const [y, m] = month.split('-').map(Number) as [number, number];
  return { from: `${month}-01`, to: `${month}-${pad2(new Date(Date.UTC(y, m, 0)).getUTCDate())}` };
}

function previous(month: string): string {
  const [y, m] = month.split('-').map(Number) as [number, number];
  const d = new Date(Date.UTC(y, m - 2, 1));
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}`;
}

/**
 * Last month; while `month` is incomplete and its data ends inside it — last month up to the same day (clamped to its
 * length). Null when the data does not cover the previous period's start (or there is no data).
 */
export function comparePeriod(
  month: string,
  p: Pick<PeriodInfo, 'incomplete' | 'dataUntil'>,
  dataFrom: string | null,
): { from: string; to: string; partial: boolean } | null {
  const prev = bounds(previous(month));
  if (dataFrom === null || dataFrom > prev.from) return null;
  if (p.incomplete && p.dataUntil !== null && p.dataUntil.slice(0, 7) === month) {
    const day = Math.min(Number(p.dataUntil.slice(8, 10)), Number(prev.to.slice(8, 10)));
    return { from: prev.from, to: `${prev.from.slice(0, 8)}${pad2(day)}`, partial: true };
  }
  return { ...prev, partial: false };
}

/** The groups (groupBy category) of a summary: all the helper reads, so a test passes just these. */
export type CategoryGroups = Pick<SpendingSummary, 'groups'>;

/** Per category in hryvnia kopecks; a currency without a rate stays out (leftOut: its own minor units). */
export function foldByCategory(
  s: CategoryGroups,
  rates: ReadonlyMap<number, FxRate>,
): { byCategory: Map<string, SpendingAmounts>; leftOut: Map<number, number> } {
  const byCategory = new Map<string, SpendingAmounts>();
  const leftOut = new Map<number, number>();
  for (const g of s.groups) {
    const uah = toUah(g.net, g.currency, rates);
    if (uah === null) {
      leftOut.set(g.currency, (leftOut.get(g.currency) ?? 0) + g.net);
      continue;
    }
    const a = byCategory.get(g.key) ?? { net: 0, purchases: 0 };
    byCategory.set(g.key, { net: a.net + uah, purchases: a.purchases + g.purchases });
  }
  return { byCategory, leftOut };
}
