// The Insights screen's month-end forecast (DataService.insightsOverview, change month-forecast): spent so far + the
// regular payments still due this month + the typical day × the days left. The typical day is month-based: each usual
// month's spending without its regular payments over its days, so a regular payment is never counted twice. Pure: the
// data service gathers the inputs.
import type { MonthForecast } from '../shared/api.ts';

/** One regular payment series as the data service prepared it (not hidden); dates YYYY-MM-DD, `uah` its usual amount. */
export type ForecastSeries = { uah: number | null; first: string; last: string; next: string; active: boolean };

/** Days in a YYYY-MM month. */
export function daysInMonth(month: string): number {
  const [y, m] = month.split('-').map(Number) as [number, number];
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** The q-th quantile (0 … 1) of the values, linear between the closest ranks; 0 for none. */
export function quantile(values: ReadonlyArray<number>, q: number): number {
  const s = [...values].sort((a, b) => a - b);
  if (s.length === 0) return 0;
  const pos = (s.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return s[lo]! + (s[hi]! - s[lo]!) * (pos - lo);
}

/**
 * Each usual month's spending a day without the regular payments: its total minus the usual amounts of the series
 * whose first … last payment spans the month, over the month's days, never below 0.
 */
export function perDayFigures(months: ReadonlyArray<{ month: string; total: number }>, series: ReadonlyArray<ForecastSeries>): number[] {
  return months.map(({ month, total }) => {
    const regular = series
      .filter((s) => s.uah !== null && s.first.slice(0, 7) <= month && s.last.slice(0, 7) >= month)
      .reduce((sum, s) => sum + s.uah!, 0);
    return Math.max(0, total - regular) / daysInMonth(month);
  });
}

/**
 * The forecast of the running month `today` falls in; null without usual months. `spent` — the month so far; `series` —
 * every regular payment series of the view (active or ended, not hidden): the active ones due after today within the
 * month are still to come, all of them leave the usual months.
 */
export function monthForecast(a: {
  today: string;
  spent: number;
  months: ReadonlyArray<{ month: string; total: number }>;
  series: ReadonlyArray<ForecastSeries>;
}): MonthForecast | null {
  if (a.months.length === 0) return null;
  const month = a.today.slice(0, 7);
  const daysLeft = daysInMonth(month) - Number(a.today.slice(8, 10));
  const end = `${month}-${String(daysInMonth(month)).padStart(2, '0')}`;
  const due = a.series.filter((s) => s.active && s.uah !== null && s.next > a.today && s.next <= end);
  const regular = due.reduce((sum, s) => sum + s.uah!, 0);
  const figures = perDayFigures(a.months, a.series);
  const perDay = Math.round(quantile(figures, 0.5));
  const perDayLow = Math.round(quantile(figures, 0.25));
  const perDayHigh = Math.round(quantile(figures, 0.75));
  const at = (day: number) => a.spent + regular + day * daysLeft;
  return { value: at(perDay), low: at(perDayLow), high: at(perDayHigh), spent: a.spent, regular, regularCount: due.length, perDay, perDayLow, perDayHigh, daysLeft };
}
