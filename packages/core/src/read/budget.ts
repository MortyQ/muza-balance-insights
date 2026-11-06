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

/** A month's left and wants shares of its income, whole per cent (the split's arithmetic). */
export type MonthShares = { left: number; wants: number };

/** The left and wants shares of one month (the Insights screen's chart); null without income. */
export function monthShares(income: number, byCategory: ReadonlyMap<string, number>, kinds: ReadonlyMap<string, KindChoice>): MonthShares | null {
  const split = budgetSplit(income, byKind(byCategory, kinds));
  return split ? { left: split.left, wants: split.wants } : null;
}

/** Where a figure stands against its guide. */
export type Standing = 'within' | 'near' | 'outside';

/** A share this many percentage points beyond its guide is near it; further is outside. */
export const NEAR_POINTS = 5;
/** A reserve from this many months up to RESERVE_MIN is near the guide. */
export const RESERVE_NEAR = 2;

/** The guided figures: a share of income with its guide and direction, or the reserve in months. */
export type GuidedMetric = 'left' | 'essential' | 'wants' | 'fixed' | 'debt' | 'reserve';

const SHARE_GUIDES: Record<Exclude<GuidedMetric, 'reserve'>, { guide: number; atLeast: boolean }> = {
  left: { guide: BUDGET_GUIDE.left, atLeast: true },
  essential: { guide: BUDGET_GUIDE.essential, atLeast: false },
  wants: { guide: BUDGET_GUIDE.wants, atLeast: false },
  fixed: { guide: FIXED_VERY_HIGH, atLeast: false },
  debt: { guide: DEBT_HIGH, atLeast: false },
};

/** The guide of a share metric (per cent) or of the reserve (months), and whether the figure should be at least it. */
export function guideOf(metric: GuidedMetric): { guide: number; atLeast: boolean } {
  return metric === 'reserve' ? { guide: RESERVE_MIN, atLeast: true } : SHARE_GUIDES[metric];
}

/**
 * A figure against its guide (spec core-budget-metrics «Standing against a guide»): a share within NEAR_POINTS beyond
 * the guide is near; the reserve is near from RESERVE_NEAR up to RESERVE_MIN months.
 */
export function guideStanding(metric: GuidedMetric, value: number): Standing {
  if (metric === 'reserve') return value >= RESERVE_MIN ? 'within' : value >= RESERVE_NEAR ? 'near' : 'outside';
  const { guide, atLeast } = SHARE_GUIDES[metric];
  const beyond = atLeast ? guide - value : value - guide;
  return beyond <= 0 ? 'within' : beyond <= NEAR_POINTS ? 'near' : 'outside';
}

/** The monthly limits against «none exceeded»: any exceeded — outside; one forecast over — near. */
export function limitsStanding(over: number, ahead: number): Standing {
  return over > 0 ? 'outside' : ahead > 0 ? 'near' : 'within';
}

/** A count where none is the guide: 0 within, 1 near, more outside (months in the red, strong signals). */
export function countStanding(n: number): Standing {
  return n <= 0 ? 'within' : n === 1 ? 'near' : 'outside';
}

/** Income at INCOME_WITHIN of the usual or more is within; from INCOME_NEAR near; below outside. */
export const INCOME_WITHIN = 0.9;
export const INCOME_NEAR = 0.75;

/** A finished month's income against the usual median; null without a usual income. */
export function incomeStanding(now: number, usual: number): Standing | null {
  if (usual <= 0) return null;
  const r = now / usual;
  return r >= INCOME_WITHIN ? 'within' : r >= INCOME_NEAR ? 'near' : 'outside';
}

/** Spending up to SPENDING_NEAR over the usual month (or points over the pace) is near. */
export const SPENDING_NEAR = 0.1;
export const PACE_NEAR_POINTS = 10;

/** A finished month's total spending against the usual month; null without a usual. */
export function spendingStanding(now: number, usual: number): Standing | null {
  if (usual <= 0) return null;
  return now <= usual ? 'within' : now <= usual * (1 + SPENDING_NEAR) ? 'near' : 'outside';
}

/** A running month: the share of a usual month spent against the share of the month passed, whole per cent. */
export function paceStanding(spentShare: number, passedShare: number): Standing {
  const over = spentShare - passedShare;
  return over <= 0 ? 'within' : over <= PACE_NEAR_POINTS ? 'near' : 'outside';
}
