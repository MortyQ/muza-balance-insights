// Pure helpers of the spending block in main (DataService.spendingOverview): the period compared with, and folding
// account currencies into hryvnia by today's rates.
import { toUah, type FxRate } from '@mono/core/read/fx';
import { PROVIDER_IDS } from '@mono/core/providers/types';
import type { PeriodInfo } from '@mono/core/read/filters';
import type { SpendingCell, SpendingGroup } from '@mono/core/read/spending';
import type { SpendingAmounts } from '../shared/api.ts';

const pad2 = (n: number) => String(n).padStart(2, '0');

/** `'2026-02'` → `{ from: '2026-02-01', to: '2026-02-28' }` (UTC calendar arithmetic, no timezone drift). */
export function monthBounds(month: string): { from: string; to: string } {
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
  const prev = monthBounds(previous(month));
  if (dataFrom === null || dataFrom > prev.from) return null;
  if (p.incomplete && p.dataUntil !== null && p.dataUntil.slice(0, 7) === month) {
    const day = Math.min(Number(p.dataUntil.slice(8, 10)), Number(prev.to.slice(8, 10)));
    return { from: prev.from, to: `${prev.from.slice(0, 8)}${pad2(day)}`, partial: true };
  }
  return { ...prev, partial: false };
}

/** The groups (groupBy category) of a summary: all the helper reads, so a test passes just these. */
export type CategoryGroups = { groups: ReadonlyArray<Pick<SpendingGroup, 'currency' | 'key' | 'net' | 'purchases'>> };

/**
 * The cells of a spending grid that `keep` lets through, summed per account currency and `keyOf`: the groups a summary
 * over those days (or months) grouped that way gives — so folding them rounds per currency and key exactly as it does.
 */
export function cellGroups(cells: readonly SpendingCell[], keep: (c: SpendingCell) => boolean, keyOf: (c: SpendingCell) => string): CategoryGroups {
  const by = new Map<string, { currency: number; key: string; net: number; purchases: number }>();
  for (const c of cells) {
    if (!keep(c)) continue;
    const key = keyOf(c);
    const id = `${c.currency}\u0000${key}`;
    const g = by.get(id) ?? { currency: c.currency, key, net: 0, purchases: 0 };
    g.net += c.net;
    g.purchases += c.purchases;
    by.set(id, g);
  }
  return { groups: [...by.values()] };
}

/** Banks in the registry's order, then the ids it does not know (specs desktop-bank-breakdown, desktop-spending-split). */
export function byRegistry<T>(parts: Map<string, T>): Array<T & { provider: string }> {
  const rank = (id: string) => {
    const i = (PROVIDER_IDS as readonly string[]).indexOf(id);
    return i < 0 ? PROVIDER_IDS.length : i;
  };
  return [...parts]
    .sort(([a], [b]) => rank(a) - rank(b) || (a < b ? -1 : a > b ? 1 : 0))
    .map(([provider, part]) => ({ provider, ...part }));
}

/**
 * Per category, each bank's part in hryvnia kopecks, from the cells of a grid split by bank (spec
 * desktop-spending-split): summed per currency, category and bank, then folded, so each part rounds on its own. A
 * currency without a rate stays out, as in foldByCategory. Banks in the registry's order.
 */
export function bankParts(cells: readonly SpendingCell[], rates: ReadonlyMap<number, FxRate>): Map<string, Array<SpendingAmounts & { provider: string }>> {
  const by = new Map<string, Map<string, SpendingAmounts>>();
  for (const g of cellGroups(cells, (c) => c.provider !== null, (c) => `${c.category}\u0000${c.provider}`).groups) {
    const uah = toUah(g.net, g.currency, rates);
    if (uah === null) continue;
    const [category, provider] = g.key.split('\u0000') as [string, string];
    const banks = by.get(category) ?? new Map<string, SpendingAmounts>();
    const a = banks.get(provider) ?? { net: 0, purchases: 0 };
    banks.set(provider, { net: a.net + uah, purchases: a.purchases + g.purchases });
    by.set(category, banks);
  }
  return new Map([...by].map(([category, banks]) => [category, byRegistry(banks)]));
}

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

/**
 * The spending block's order of categories: net > 0 only, net desc, then the word. The «Now» strip ranks its top
 * category by it too, so both give a category the same colour.
 */
export function rankedCategories(m: ReadonlyMap<string, SpendingAmounts>): Array<[string, SpendingAmounts]> {
  return [...m].filter(([, a]) => a.net > 0).sort(([ka, a], [kb, b]) => b.net - a.net || (ka < kb ? -1 : 1));
}
