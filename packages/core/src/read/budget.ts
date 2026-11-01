// Budget metrics (E3 of «Фінансова грамотність»): how a month's income splits into essential, wants and what is left
// (50/30/20), the shares of fixed costs and of loan payments, and how many usual months the money at hand would cover.
// Pure: numbers in (kopecks, by category and kind), numbers out. The guides are common advice, shown as such.
import { CATEGORY } from '../derive/categories.ts';
import type { KindChoice } from './category-kinds.ts';
import { INSIGHT_MIN_MONTHS, median } from './insights.ts';

/** The 50/30/20 guide: essential, wants, what is left — per cent of income. */
export const BUDGET_GUIDE = { essential: 50, wants: 30, left: 20 } as const;
/** Fixed costs above this share of income leave little room; above the second, very little. */
export const FIXED_HIGH = 50;
export const FIXED_VERY_HIGH = 60;
/** Loan payments above this share of income are high. */
export const DEBT_HIGH = 30;
/** The reserve's guide, in usual months of essential spending. */
export const RESERVE_MIN = 3;
export const RESERVE_GOOD = 6;

/** A month's spending folded by kind, kopecks; `fixed` counts the fixed categories whatever their kind. */
export type KindTotals = { essential: number; wants: number; savings: number; fixed: number };

/** Folds net spending by category into kinds; a category without a kind (income, own transfers) is left out. */
export function byKind(byCategory: ReadonlyMap<string, number>, kinds: ReadonlyMap<string, KindChoice>): KindTotals {
  const t: KindTotals = { essential: 0, wants: 0, savings: 0, fixed: 0 };
  for (const [category, net] of byCategory) {
    const k = kinds.get(category);
    if (!k) continue;
    t[k.kind] += net;
    if (k.fixed) t.fixed += net;
  }
  return t;
}

const pct = (part: number, whole: number) => Math.round((part / whole) * 100);

/** Essential, wants and what is left (income − essential − wants; savings stay in it) as whole per cent of income. */
export type BudgetSplit = { essential: number; wants: number; left: number };

/** The 50/30/20 split of a month's income; null without income. */
export function budgetSplit(income: number, t: Readonly<KindTotals>): BudgetSplit | null {
  if (income <= 0) return null;
  const essential = pct(t.essential, income);
  const wants = pct(t.wants, income);
  return { essential, wants, left: pct(income - t.essential - t.wants, income) };
}

/** Fixed costs as whole per cent of income; null without income. */
export function fixedShare(income: number, t: Readonly<KindTotals>): number | null {
  return income > 0 ? pct(t.fixed, income) : null;
}

/** «Installments and loans» as whole per cent of income; null without income. */
export function debtShare(income: number, byCategory: ReadonlyMap<string, number>): number | null {
  return income > 0 ? pct(byCategory.get(CATEGORY.installments) ?? 0, income) : null;
}

/** The reserve: the money at hand and the usual essential month it is divided by. */
export type Reserve = { months: number; money: number; usualEssential: number };

/**
 * The money at hand ÷ the median essential spending of the usual whole months, to one decimal; null with fewer than
 * INSIGHT_MIN_MONTHS months or a zero median.
 */
export function reserveMonths(money: number, essentialMonths: ReadonlyArray<number>): Reserve | null {
  if (essentialMonths.length < INSIGHT_MIN_MONTHS) return null;
  const usualEssential = median(essentialMonths);
  if (usualEssential <= 0) return null;
  return { months: Math.round((money / usualEssential) * 10) / 10, money, usualEssential };
}
