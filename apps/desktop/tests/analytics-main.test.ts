// Pure helpers of the analytics screen in main. Fictional numbers only.
import { describe, expect, it } from 'vitest';
import { bucketState, daysOf, foldCells, foldIncome, monthsBetween, previousRange, runningTotals, usualCurve } from '../src/main/analytics.ts';
import { addMonths, monthSpan } from '../src/shared/analytics.ts';

const RATES = new Map([[840, { rate: 40, nearest: false }]]);

describe('analytics helpers (main)', () => {
  it('months: add, span, between, the range before', () => {
    expect(addMonths('2026-12', 1)).toBe('2027-01');
    expect(addMonths('2026-01', -1)).toBe('2025-12');
    expect(monthSpan('2025-10', '2026-09')).toBe(12);
    expect(monthsBetween('2025-11', '2026-02')).toEqual(['2025-11', '2025-12', '2026-01', '2026-02']);
    expect(previousRange('2026-01', '2026-03')).toEqual({ from: '2025-10-01', to: '2025-12-31' });
  });

  it('days of a month', () => {
    expect(daysOf('2026-02')).toHaveLength(28);
    expect(daysOf('2026-02')[0]).toBe('2026-02-01');
    expect(daysOf('2024-02').at(-1)).toBe('2024-02-29');
  });

  it('bucket states', () => {
    const at = { today: '2026-03-15', dataFrom: '2026-01-01' };
    expect(bucketState('2026-03-15', 'day', at)).toBe('running');
    expect(bucketState('2026-03-16', 'day', at)).toBe('none');
    expect(bucketState('2026-03-14', 'day', at)).toBe('full');
    expect(bucketState('2025-12-31', 'day', at)).toBe('none');
    expect(bucketState('2026-03', 'month', at)).toBe('running');
    expect(bucketState('2026-02', 'month', at)).toBe('full');
    expect(bucketState('2025-12', 'month', at)).toBe('none');
    expect(bucketState('2026-02', 'month', { today: '2026-03-15', dataFrom: null })).toBe('none');
  });

  it('foldCells: per category per bucket in hryvnia; a currency without a rate is left out', () => {
    const cells = [
      { currency: 980, bucket: '2026-02', category: 'продукты', purchases: 1, gross: 20_000, refunds: 0, net: 20_000 },
      { currency: 840, bucket: '2026-03', category: 'продукты', purchases: 1, gross: 100, refunds: 0, net: 100 },
      { currency: 978, bucket: '2026-03', category: 'кафе', purchases: 1, gross: 50, refunds: 0, net: 50 },
    ];
    const f = foldCells(cells, ['2026-02', '2026-03'], RATES);
    expect([...f.net]).toEqual([['продукты', [20_000, 4_000]]]);
    expect(f.purchases.get('продукты')).toBe(2);
    expect(f.leftOut).toEqual(new Set([978]));
  });

  it('foldIncome: per bucket in hryvnia', () => {
    const groups = [{ currency: 980, key: '2026-03-02', total: 50_000 }, { currency: 840, key: '2026-03-04', total: 100 }, { currency: 978, key: '2026-03-04', total: 9 }];
    const f = foldIncome(groups, ['2026-03-01', '2026-03-02', '2026-03-03', '2026-03-04'], RATES);
    expect(f.values).toEqual([0, 50_000, 0, 4_000]);
    expect(f.leftOut).toEqual(new Set([978]));
  });

  it('running totals and the usual month', () => {
    expect(runningTotals([0, 5, 0, 10])).toEqual([0, 5, 5, 15]);
    // A 3-day month carried at its last value to the 4th day.
    expect(usualCurve([[0, 10, 10, 30], [20, 20, 20]], 4)).toEqual([10, 15, 15, 25]);
    expect(usualCurve([], 4)).toBeNull();
  });
});
