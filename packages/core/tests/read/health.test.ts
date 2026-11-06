// «Financial health» references (read/health.ts): the usual and unusual months, the trend of a share, the forecast.
import { describe, expect, it } from 'vitest';
import { leftForecast, shareTrend, usualOf, versusUsual } from '../../src/read/health.ts';

const SHARES = [-21, 44, 18, -12, 8, -59];

describe('health references', () => {
  it('the usual is the median, a month beyond 15 points is unusual; a month without income is skipped', () => {
    expect(usualOf(SHARES)).toEqual({ usual: -2, unusual: ['below', 'above', 'above', null, null, 'below'] });
    expect(usualOf([10, null, 12, 30])).toEqual({ usual: 12, unusual: [null, null, null, 'above'] });
    expect(usualOf([10, null, 12])).toBeNull();
  });

  it('the trend: the last three against up to three before; the good direction decides', () => {
    expect(shareTrend(SHARES, true)).toEqual({ now: -21, before: 14, direction: 'worse' });
    expect(shareTrend(SHARES, false)).toMatchObject({ direction: 'better' });
    expect(shareTrend([20, 21, 22, 23], true)).toEqual({ now: 22, before: 20, direction: 'same' });
    expect(shareTrend([20, null, 21, 22], true)).toBeNull();
  });

  it('the forecast: spent so far plus the usual rest of the month, from the 10th day, with a range', () => {
    const usual = [
      { income: 50_000_00, essential: 30_000_00, wants: 12_000_00 },
      { income: 50_000_00, essential: 26_000_00, wants: 10_000_00 },
      { income: 50_000_00, essential: 34_000_00, wants: 14_000_00 },
      { income: 0, essential: 90_000_00, wants: 90_000_00 },
    ];
    const spent = { essential: 20_000_00, wants: 9_000_00 };
    // (50 000 − (20 000 + 15 000) − (9 000 + 6 000)) ÷ 50 000 = 0%; the range by the heaviest and the lightest months.
    expect(leftForecast({ day: 15, days: 30, spent, usual })).toEqual({ value: 0, low: -6, high: 6 });
    expect(leftForecast({ day: 9, days: 30, spent, usual })).toBeNull();
    expect(leftForecast({ day: 10, days: 30, spent, usual })).not.toBeNull();
    expect(leftForecast({ day: 15, days: 30, spent, usual: usual.slice(1) })).toBeNull();
  });

  it('a month against the usual: 3 points in the good direction decide', () => {
    expect(versusUsual(32, 36, false)).toBe('better');
    expect(versusUsual(34, 37, true)).toBe('worse');
    expect(versusUsual(36, 37, true)).toBe('same');
  });
});
