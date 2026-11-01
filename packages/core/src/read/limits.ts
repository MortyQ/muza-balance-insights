// Spending limits and the monthly budget (E2 of «Фінансова грамотність»): pace, forecast, «per day» and the state of
// a limit, the budget's fixed costs set aside first, and a suggested amount from the usual months. Pure: the data
// process reads the spending of the period and hands the numbers here.
import { INSIGHT_MIN_MONTHS, median } from './insights.ts';

export const LIMIT_PERIODS = ['day', 'week', 'month'] as const;
export type LimitPeriod = (typeof LIMIT_PERIODS)[number];
export type LimitStateName = 'ok' | 'attention' | 'exceeded';

/** From this share of the limit spent, a limit needs attention. */
export const ATTENTION_SHARE = 0.8;
/** A forecast over the limit makes a state only once this share of the period has passed. */
export const FORECAST_FROM = 0.25;
/** Days in an average month, to scale a monthly suggestion to a week or a day. */
export const MONTH_DAYS = 30.44;
/** Suggested amounts are rounded to 100 ₴ (kopecks). */
export const SUGGEST_STEP = 10_000;

export type LimitFigures = {
  spent: number;
  /** amount − spent; below zero when over. */
  left: number;
  /** Whole per cent of the amount spent. */
  percent: number;
  /** What the pace allows by today, today counted. */
  expected: number;
  /** spent ÷ days passed × days; null for a day limit. */
  forecast: number | null;
  /** What is left ÷ days left, today counted; 0 when nothing is left. */
  perDay: number;
  daysLeft: number;
  state: LimitStateName;
};

/** A limit's figures on a day of its period: `daysPassed` 1 … `days`, today counted. */
export function limitState(l: { amount: number; spent: number; daysPassed: number; days: number; period: LimitPeriod }): LimitFigures {
  const daysLeft = Math.max(1, l.days - l.daysPassed + 1);
  const left = l.amount - l.spent;
  const forecast = l.period === 'day' ? null : Math.round((l.spent / Math.max(1, l.daysPassed)) * l.days);
  const percent = l.amount > 0 ? Math.round((l.spent / l.amount) * 100) : 0;
  const forecastCounts = forecast !== null && l.daysPassed >= l.days * FORECAST_FROM && forecast > l.amount;
  const state: LimitStateName = l.spent > l.amount ? 'exceeded' : l.spent >= l.amount * ATTENTION_SHARE || forecastCounts ? 'attention' : 'ok';
  return {
    spent: l.spent,
    left,
    percent,
    expected: Math.round((l.amount * l.daysPassed) / l.days),
    forecast,
    perDay: Math.max(0, Math.round(left / daysLeft)),
    daysLeft,
    state,
  };
}

/** The median of the usual whole months, scaled to the period and rounded to SUGGEST_STEP; null under 3 months. */
export function suggestedAmount(months: ReadonlyArray<number>, period: LimitPeriod): number | null {
  if (months.length < INSIGHT_MIN_MONTHS) return null;
  const m = median(months);
  const scaled = period === 'month' ? m : period === 'week' ? (m * 7) / MONTH_DAYS : m / MONTH_DAYS;
  const amount = Math.round(scaled / SUGGEST_STEP) * SUGGEST_STEP;
  return amount > 0 ? amount : null;
}

export type FixedRow = { category: string; amount: number; paid: number };

export type BudgetParts = {
  /** The typed amounts of the fixed rows, set aside first. */
  fixedTotal: number;
  /** total − fixed, never below 0. */
  flexibleAmount: number;
  /** Flexible spending plus what fixed rows spent above their typed amounts. */
  flexibleSpent: number;
  fixedTakesAll: boolean;
};

/** The monthly budget: the user's fixed rows set aside at their typed amounts, the rest is the flexible part. */
export function budgetParts(b: { amount: number; fixed: ReadonlyArray<FixedRow>; flexibleSpent: number }): BudgetParts {
  const fixedTotal = b.fixed.reduce((s, r) => s + r.amount, 0);
  const over = b.fixed.reduce((s, r) => s + Math.max(0, r.paid - r.amount), 0);
  return {
    fixedTotal,
    flexibleAmount: Math.max(0, b.amount - fixedTotal),
    flexibleSpent: b.flexibleSpent + over,
    fixedTakesAll: fixedTotal >= b.amount,
  };
}
