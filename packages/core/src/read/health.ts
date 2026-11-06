// «Financial health» references (spec core-budget-metrics): the user's usual share and its unusual months, the trend
// of a share, and the forecast of a running month's left share. Pure: whole per cent and kopecks in, numbers out.
import { median } from './insights.ts';

/** A month this many percentage points from the usual is unusual. */
export const UNUSUAL_POINTS = 15;
/** Means this many points apart in the good direction are better (or worse); closer — about the same. */
export const TREND_POINTS = 3;
/** The forecast starts on this day of the month: earlier a few payments decide it. */
export const FORECAST_FROM_DAY = 10;
/** Months with income the usual and the forecast need. */
export const USUAL_MIN_MONTHS = 3;

export type Unusual = 'above' | 'below' | null;

/** The median of the months with income and, per month, whether it is beyond UNUSUAL_POINTS; null under 3 months. */
export function usualOf(shares: ReadonlyArray<number | null>): { usual: number; unusual: Unusual[] } | null {
  const known = shares.filter((s): s is number => s !== null);
  if (known.length < USUAL_MIN_MONTHS) return null;
  const usual = Math.round(median(known));
  const unusual = shares.map((s): Unusual => (s === null ? null : s > usual + UNUSUAL_POINTS ? 'above' : s < usual - UNUSUAL_POINTS ? 'below' : null));
  return { usual, unusual };
}

export type TrendDirection = 'better' | 'worse' | 'same';

const mean = (xs: ReadonlyArray<number>) => Math.round(xs.reduce((s, x) => s + x, 0) / xs.length);

/**
 * The last 3 months with income against up to 3 before them; `goodUp` — a higher share is better (the left share).
 * Null with fewer than 4 months with income.
 */
export function shareTrend(shares: ReadonlyArray<number | null>, goodUp: boolean): { now: number; before: number; direction: TrendDirection } | null {
  const known = shares.filter((s): s is number => s !== null);
  if (known.length < 4) return null;
  const now = mean(known.slice(-3));
  const before = mean(known.slice(-6, -3).length > 0 ? known.slice(Math.max(0, known.length - 6), -3) : []);
  const diff = goodUp ? now - before : before - now;
  return { now, before, direction: diff >= TREND_POINTS ? 'better' : diff <= -TREND_POINTS ? 'worse' : 'same' };
}

/** A usual month: its income and its essential and wants spending, kopecks. */
export type UsualKindMonth = { income: number; essential: number; wants: number };

export type LeftForecast = { value: number; low: number; high: number };

/**
 * The running month's left share: (usual income − forecast essential − forecast wants) ÷ usual income, a kind's forecast
 * being what it spent so far plus the usual months' median of it times the share of the month still to come; the range
 * takes the heaviest and the lightest usual month of each kind. Null before FORECAST_FROM_DAY or under 3 usual months
 * with income.
 */
export function leftForecast(a: { day: number; days: number; spent: { essential: number; wants: number }; usual: ReadonlyArray<UsualKindMonth> }): LeftForecast | null {
  if (a.day < FORECAST_FROM_DAY || a.days <= 0) return null;
  const months = a.usual.filter((m) => m.income > 0);
  if (months.length < USUAL_MIN_MONTHS) return null;
  const income = median(months.map((m) => m.income));
  if (income <= 0) return null;
  const rest = Math.max(0, a.days - a.day) / a.days;
  const left = (pick: (xs: number[]) => number) => {
    const essential = a.spent.essential + pick(months.map((m) => m.essential)) * rest;
    const wants = a.spent.wants + pick(months.map((m) => m.wants)) * rest;
    return Math.round(((income - essential - wants) / income) * 100);
  };
  return { value: left(median), low: left((xs) => Math.max(...xs)), high: left((xs) => Math.min(...xs)) };
}

/** A month's share against the user's usual of it: better, worse or about the same by TREND_POINTS. */
export function versusUsual(now: number, usual: number, goodUp: boolean): TrendDirection {
  const diff = goodUp ? now - usual : usual - now;
  return diff >= TREND_POINTS ? 'better' : diff <= -TREND_POINTS ? 'worse' : 'same';
}
