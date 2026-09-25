// Pure helpers of the screen: money formatting and Kyiv months.
import { describe, expect, it } from 'vitest';
import { formatMoney, currencySymbol } from '../src/renderer/src/shared/lib/money.ts';
import { kyivToday, monthRange, monthTitle, shiftMonth, shortDate } from '../src/renderer/src/shared/lib/months.ts';

// Intl puts a no-break space between thousands; compare with plain spaces.
const plain = (s: string) => s.replace(/[  ]/g, ' ');

describe('formatMoney', () => {
  it.each([
    [1_234_000, 980, false, '12 340 ₴'],
    [1_234_056, 980, true, '12 340,56 ₴'],
    [-5, 980, true, '-0,05 ₴'],
    [0, 840, false, '0 $'],
    [123_456, 978, false, '1 235 €'], // rounded to whole units in summaries
    [1500, 392, true, '1 500 JPY'], // exponent 0
    [12_345, 414, true, '12,345 KWD'], // exponent 3
  ] as const)('%i of %i (minor units: %s) → %s', (minor, cur, minorUnits, out) => {
    expect(plain(formatMoney(minor, cur, { minorUnits }))).toBe(out);
  });

  it('symbols for common currencies, the ISO code otherwise', () => {
    expect([980, 840, 978, 826, 985, 8].map(currencySymbol)).toEqual(['₴', '$', '€', '£', 'zł', 'ALL']);
  });
});

describe('months (Kyiv)', () => {
  it('today is the Kyiv date, not UTC', () => {
    expect(kyivToday(new Date('2026-09-30T22:30:00Z'))).toBe('2026-10-01'); // 01:30 in Kyiv
    expect(kyivToday(new Date('2026-09-30T20:00:00Z'))).toBe('2026-09-30');
  });

  it('shift across years, ranges with the right last day, titles', () => {
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2025-12', 1)).toBe('2026-01');
    expect(shiftMonth('2026-03', -26)).toBe('2024-01');
    expect(monthRange('2024-02')).toEqual({ from: '2024-02-01', to: '2024-02-29' });
    expect(monthRange('2026-09')).toEqual({ from: '2026-09-01', to: '2026-09-30' });
    expect(monthTitle('2026-09')).toBe('сентябрь 2026');
  });

  it('short dates', () => {
    expect(shortDate('2026-03-10')).toBe('10.03');
    expect(shortDate('2026-03-10 23:00')).toBe('10.03, 23:00');
  });
});
