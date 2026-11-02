// The «Budget» screen's read (DataService.limitsOverview): the plans of a view counted against «Personal» spending of
// every bank, by core read/limits.ts. Pure assembly over sums the service has read; amounts are hryvnia kopecks by
// today's rates.
import { CATEGORY } from '@mono/core/derive/categories';
import type { KindChoice } from '@mono/core/read/category-kinds';
import { toUah, type FxRate } from '@mono/core/read/fx';
import type { Goal } from '@mono/core/read/goals';
import { budgetParts, limitState, suggestedAmount, type LimitPeriod } from '@mono/core/read/limits';
import type { CategoryLimitView, LimitFiguresView, MonthBudgetView } from '../shared/api.ts';
import type { KindCategoryId } from '../shared/categories.ts';
import { isoWeekday } from '../shared/dates.ts';
import { monthBounds } from './spending.ts';

/** How many suggested limits the empty screen offers. */
export const SUGGESTIONS_MAX = 5;

/** Category word → net spending, kopecks. */
export type Sums = ReadonlyMap<string, number>;
/** Category word → the pending holds' net and how many operations (core `holds: 'pending'`). */
export type PendingSums = ReadonlyMap<string, { net: number; purchases: number }>;
/**
 * One owner's spending of today, this week and the shown month (a past month: the month only), pending holds left
 * out, and the pending holds of the same periods apart.
 */
export type OwnerSums = { day: Sums; week: Sums; month: Sums; pending: { day: PendingSums; week: PendingSums; month: PendingSums } };

export const NO_PENDING: PendingSums = new Map();

/** The pending holds of some categories: their amount and count (fee lines add to the amount, not the count); null — none. */
export function pendingOf(p: PendingSums, words: Iterable<string>): { count: number; amount: number } | null {
  let count = 0;
  let amount = 0;
  for (const w of words) {
    const a = p.get(w);
    if (!a) continue;
    amount += a.net;
    if (w !== CATEGORY.fees && w !== CATEGORY.transferFees) count += a.purchases;
  }
  return amount > 0 ? { count: Math.max(1, count), amount } : null;
}

/** Where today stands in a period: days passed (today counted) and days in it. A past month: all of it. */
export function periodPosition(period: LimitPeriod, today: string, month: string, current: boolean): { daysPassed: number; days: number } {
  if (period === 'day') return { daysPassed: 1, days: 1 };
  if (period === 'week') return { daysPassed: isoWeekday(today), days: 7 };
  const days = Number(monthBounds(month).to.slice(8, 10));
  return { daysPassed: current ? Number(today.slice(8, 10)) : days, days };
}

export function figures(
  amount: number,
  spent: number,
  period: LimitPeriod,
  pos: { daysPassed: number; days: number },
  pending: { count: number; amount: number } | null = null,
): LimitFiguresView {
  const f = limitState({ amount, spent, ...pos, period });
  return { amount, ...f, daysPassed: pos.daysPassed, days: pos.days, pending };
}

const sum = (s: Sums, words: Iterable<string>) => [...words].reduce((a, w) => a + (s.get(w) ?? 0), 0);

/** A category limit counted against its owner's spending of its period; figures null without a rate. */
export function limitView(
  g: Extract<Goal, { type: 'limit' }>,
  idOf: (word: string) => KindCategoryId,
  sums: OwnerSums,
  pos: (p: LimitPeriod) => { daysPassed: number; days: number },
  rates: ReadonlyMap<number, FxRate>,
): CategoryLimitView {
  const amount = toUah(g.amount, g.currency, rates);
  return {
    id: g.id,
    categoryId: idOf(g.category),
    period: g.period,
    owner: g.participantId,
    currency: g.currency,
    amountMinor: g.amount,
    figures: amount === null ? null : figures(amount, sums[g.period].get(g.category) ?? 0, g.period, pos(g.period), pendingOf(sums.pending[g.period], [g.category])),
  };
}

/** The monthly budget: the typed fixed rows set aside, the rest against every category neither fixed here nor savings (nor taxes, while it does not count them). */
export function budgetView(
  g: Extract<Goal, { type: 'budget' }>,
  idOf: (word: string) => KindCategoryId,
  month: Sums,
  kinds: ReadonlyMap<string, KindChoice>,
  pos: { daysPassed: number; days: number },
  current: boolean,
  rates: ReadonlyMap<number, FxRate>,
  pending: PendingSums = NO_PENDING,
): MonthBudgetView | null {
  const total = toUah(g.amount, g.currency, rates);
  if (total === null) return null;
  const fixed = g.fixed.map((r) => ({ categoryId: idOf(r.category), amountMinor: r.amount, amount: toUah(r.amount, g.currency, rates) ?? 0, paid: month.get(r.category) ?? 0, word: r.category }));
  const listed = new Set(g.fixed.map((r) => r.category));
  const flexibleWords = [...kinds].filter(([w, k]) => !listed.has(w) && k.kind !== 'savings' && (g.countTaxes || w !== CATEGORY.taxes)).map(([w]) => w);
  const flexibleSpent = sum(month, flexibleWords);
  const parts = budgetParts({ amount: total, fixed: fixed.map((r) => ({ category: r.word, amount: r.amount, paid: r.paid })), flexibleSpent });
  const fixedPaid = fixed.reduce((s, r) => s + r.paid, 0);
  const left = total - fixedPaid - flexibleSpent;
  return {
    id: g.id,
    owner: g.participantId,
    currency: g.currency,
    amountMinor: g.amount,
    total,
    fixed: fixed.map(({ word: _w, ...r }) => r),
    fixedTotal: parts.fixedTotal,
    fixedPaid,
    fixedTakesAll: parts.fixedTakesAll,
    countTaxes: g.countTaxes,
    flexible: figures(parts.flexibleAmount, parts.flexibleSpent, 'month', pos, pendingOf(pending, flexibleWords)),
    result: current ? null : { within: left >= 0, left },
  };
}

/** Flexible categories (neither fixed nor savings) with a suggested monthly amount and no monthly limit yet, largest first. */
export function suggestions(
  past: ReadonlyArray<Sums>,
  kinds: ReadonlyMap<string, KindChoice>,
  limited: ReadonlySet<string>,
  idOf: (word: string) => KindCategoryId,
): Array<{ categoryId: KindCategoryId; amount: number }> {
  return [...kinds]
    .filter(([w, k]) => k.kind !== 'savings' && !k.fixed && !limited.has(w) && w !== CATEGORY.fees && w !== CATEGORY.transferFees)
    .flatMap(([w]) => {
      const amount = suggestedAmount(past.map((m) => m.get(w) ?? 0), 'month');
      return amount === null ? [] : [{ categoryId: idOf(w), amount }];
    })
    .sort((a, b) => b.amount - a.amount || a.categoryId.localeCompare(b.categoryId))
    .slice(0, SUGGESTIONS_MAX);
}
