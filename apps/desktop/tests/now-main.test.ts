// Pure helpers of the «Now» strip in main: Kyiv calendar days, the week from Monday, the usual day.
import { describe, expect, it } from 'vitest';
import { isoWeekday, median, shiftDate, sumAmounts, sumDays, usualDay, weekDays } from '../src/main/now.ts';

const a = (net: number, purchases = 1) => ({ net, purchases });

describe('shiftDate / isoWeekday', () => {
  it('shifts across months and years', () => {
    expect(shiftDate('2026-03-01', -1)).toBe('2026-02-28');
    expect(shiftDate('2026-12-31', 1)).toBe('2027-01-01');
    expect(shiftDate('2026-03-10', -30)).toBe('2026-02-08');
  });

  it('1 = Monday … 7 = Sunday', () => {
    expect(isoWeekday('2026-03-09')).toBe(1);
    expect(isoWeekday('2026-03-10')).toBe(2);
    expect(isoWeekday('2026-10-03')).toBe(6);
    expect(isoWeekday('2026-03-15')).toBe(7);
  });
});

describe('median', () => {
  it('the middle value; for an even count the mean of the two middle ones, rounded', () => {
    expect(median([300, 100, 200])).toBe(200);
    expect(median([1_000, 2_000, 3_000, 10_000])).toBe(2_500);
    expect(median([1, 2])).toBe(2);
  });
});

describe('usualDay', () => {
  // 03-01 … 03-05: 1 000 … 5 000; nothing on 03-06 … 03-08.
  const byDay = new Map(['2026-03-01', '2026-03-02', '2026-03-03', '2026-03-04', '2026-03-05'].map((d, i) => [d, a((i + 1) * 1_000)]));

  it('a day without spending counts as 0', () => {
    // 0 0 1 000 2 000 3 000 4 000 5 000
    expect(usualDay(byDay, '2026-03-01', '2026-03-07')).toBe(2_000);
    // 0 0 0 1 000 2 000 3 000 4 000 5 000 → (1 000 + 2 000) / 2
    expect(usualDay(byDay, '2026-03-01', '2026-03-08')).toBe(1_500);
  });

  it('null under 7 days, or an empty range', () => {
    expect(usualDay(byDay, '2026-03-01', '2026-03-06')).toBeNull();
    expect(usualDay(byDay, '2026-03-05', '2026-03-01')).toBeNull();
  });
});

describe('weekDays / sumDays / sumAmounts', () => {
  const byDay = new Map([['2026-03-09', a(25_100, 3)], ['2026-03-10', a(15_000, 2)]]);

  it('Monday … Sunday; null after today, 0 for a past day without spending', () => {
    expect(weekDays(byDay, '2026-03-09', '2026-03-10')).toEqual([25_100, 15_000, null, null, null, null, null]);
    expect(weekDays(byDay, '2026-03-09', '2026-03-15')).toEqual([25_100, 15_000, 0, 0, 0, 0, 0]);
  });

  it('sums the days of a range, and any amounts', () => {
    expect(sumDays(byDay, '2026-03-08', '2026-03-09')).toEqual({ net: 25_100, purchases: 3 });
    expect(sumDays(byDay, '2026-03-09', '2026-03-10')).toEqual({ net: 40_100, purchases: 5 });
    expect(sumAmounts([a(1, 1), a(2, 2)])).toEqual({ net: 3, purchases: 3 });
  });
});
