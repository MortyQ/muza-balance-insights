// The Insights screen's month-end forecast (data/forecast.ts, change month-forecast): spent so far + the regular
// payments still due + the typical day × the days left, the typical day without regular payments. Fictional numbers.
import { describe, expect, it } from 'vitest';
import { daysInMonth, monthForecast, perDayFigures, quantile, type ForecastSeries } from '../src/data/forecast.ts';

/** Rent, 500 ₴ on the 20th since March; next due 20 September. */
const RENT: ForecastSeries = { uah: 50_000, first: '2026-03-20', last: '2026-08-20', next: '2026-09-20', active: true };
/** Per-day spending without rent: June 100 ₴, July 320 ₴, August 200 ₴ (kopecks × days + rent). */
const MONTHS = [
  { month: '2026-08', total: 20_000 * 31 + 50_000 },
  { month: '2026-07', total: 32_000 * 31 + 50_000 },
  { month: '2026-06', total: 10_000 * 30 + 50_000 },
];

describe('month forecast', () => {
  it('days in a month and linear quantiles', () => {
    expect([daysInMonth('2026-02'), daysInMonth('2028-02'), daysInMonth('2026-09'), daysInMonth('2026-12')]).toEqual([28, 29, 30, 31]);
    expect(quantile([30, 10, 20], 0.25)).toBe(15);
    expect(quantile([30, 10, 20], 0.5)).toBe(20);
    expect(quantile([10, 20, 30, 40], 0.5)).toBe(25);
    expect(quantile([], 0.5)).toBe(0);
  });

  it('day 10 of 30: spent + the regular payment still due + the typical day × 20 days left; the range from the quartiles', () => {
    const f = monthForecast({ today: '2026-09-10', spent: 600_000, months: MONTHS, series: [RENT] });
    expect(f).toEqual({
      value: 1_050_000, low: 950_000, high: 1_170_000,
      spent: 600_000, regular: 50_000, regularCount: 1, perDay: 20_000, perDayLow: 15_000, perDayHigh: 26_000, daysLeft: 20,
    });
    expect(f!.low).toBeLessThanOrEqual(f!.value);
    expect(f!.value).toBeLessThanOrEqual(f!.high);
  });

  it('a regular payment is counted once: already paid this month — not due, and left out of the typical day either way', () => {
    // Paid on the 3rd: in `spent`, next due in October.
    const paid: ForecastSeries = { ...RENT, last: '2026-09-03', next: '2026-10-03' };
    const f = monthForecast({ today: '2026-09-10', spent: 600_000, months: MONTHS, series: [paid] })!;
    expect(f).toMatchObject({ regular: 0, regularCount: 0, perDay: 20_000, value: 600_000 + 20_000 * 20 });
    // Without the series the usual months keep the rent inside the typical day: higher by its share of a day.
    const none = monthForecast({ today: '2026-09-10', spent: 600_000, months: MONTHS, series: [] })!;
    expect(none.perDay).toBeGreaterThan(f.perDay);
  });

  it('only active series due after today within the month; a series is taken out only of the months it spans', () => {
    const ended: ForecastSeries = { ...RENT, active: false };
    const late: ForecastSeries = { ...RENT, next: '2026-09-08' };
    const today: ForecastSeries = { ...RENT, next: '2026-09-10' };
    const nextMonth: ForecastSeries = { ...RENT, next: '2026-10-01' };
    const noRate: ForecastSeries = { ...RENT, uah: null };
    for (const s of [ended, late, today, nextMonth, noRate]) {
      expect(monthForecast({ today: '2026-09-10', spent: 0, months: MONTHS, series: [s] })!.regular).toBe(0);
    }
    const lastDay: ForecastSeries = { ...RENT, next: '2026-09-30' };
    expect(monthForecast({ today: '2026-09-10', spent: 0, months: MONTHS, series: [lastDay] })!.regularCount).toBe(1);
    // A subscription since August leaves June and July whole.
    const recent: ForecastSeries = { uah: 31_000, first: '2026-08-05', last: '2026-08-05', next: '2026-09-05', active: true };
    expect(perDayFigures(MONTHS, [recent])).toEqual([(20_000 * 31 + 50_000 - 31_000) / 31, (32_000 * 31 + 50_000) / 31, (10_000 * 30 + 50_000) / 30]);
    // Never below zero.
    expect(perDayFigures([{ month: '2026-08', total: 10_000 }], [RENT])).toEqual([0]);
  });

  it('the last day of the month: no days left, the range collapses; no usual months — none', () => {
    const f = monthForecast({ today: '2026-09-30', spent: 600_000, months: MONTHS, series: [RENT] })!;
    expect(f).toMatchObject({ daysLeft: 0, value: 600_000, low: 600_000, high: 600_000 });
    expect(monthForecast({ today: '2026-09-10', spent: 600_000, months: [], series: [RENT] })).toBeNull();
  });
});
