// Pure helpers of the spending block in main: which period is compared, how account currencies fold into hryvnia.
import { describe, expect, it } from 'vitest';
import type { SpendingGroup } from '@mono/core/summaries';
import { comparePeriod, foldByCategory, rankedCategories, type CategoryGroups } from '../src/main/spending.ts';

describe('comparePeriod', () => {
  it('a complete month → the whole previous month', () => {
    expect(comparePeriod('2026-02', { incomplete: false, dataUntil: '2026-03-10' }, '2026-01-01')).toEqual({ from: '2026-01-01', to: '2026-01-31', partial: false });
  });
  it('a month in progress → the previous month cut to the same day, clamped to its length', () => {
    expect(comparePeriod('2026-03', { incomplete: true, dataUntil: '2026-03-10' }, '2026-01-01')).toEqual({ from: '2026-02-01', to: '2026-02-10', partial: true });
    expect(comparePeriod('2026-03', { incomplete: true, dataUntil: '2026-03-30' }, '2026-01-01')).toEqual({ from: '2026-02-01', to: '2026-02-28', partial: true });
  });
  it('January compares with December of the year before', () => {
    expect(comparePeriod('2026-01', { incomplete: false, dataUntil: '2026-03-10' }, '2025-06-01')).toEqual({ from: '2025-12-01', to: '2025-12-31', partial: false });
  });
  it('null when the data starts after the previous period starts, or there is no data', () => {
    expect(comparePeriod('2026-01', { incomplete: false, dataUntil: '2026-03-10' }, '2026-01-01')).toBeNull();
    expect(comparePeriod('2026-02', { incomplete: false, dataUntil: '2026-03-10' }, '2026-01-02')).toBeNull();
    expect(comparePeriod('2026-02', { incomplete: true, dataUntil: null }, null)).toBeNull();
  });
  it('an incomplete month whose data ends before it → the whole previous month', () => {
    expect(comparePeriod('2026-04', { incomplete: true, dataUntil: '2026-03-10' }, '2026-01-01')).toEqual({ from: '2026-03-01', to: '2026-03-31', partial: false });
  });
});

const group = (currency: number, key: string, net: number, purchases: number): SpendingGroup =>
  ({ currency, key, lines: purchases, purchases, gross: net, refunds: 0, net, netPerDay: null });
const summary = (groups: SpendingGroup[]): CategoryGroups => ({ groups });

describe('foldByCategory', () => {
  it('folds a currency with a rate into hryvnia per category; one without a rate is left out', () => {
    const rates = new Map([[840, { rate: 41, nearest: false }]]);
    const f = foldByCategory(summary([group(980, 'продукты', 10_000, 2), group(840, 'продукты', 100, 1), group(840, 'путешествия', 500, 1), group(978, 'кафе', 300, 1)]), rates);
    expect([...f.byCategory]).toEqual([
      ['продукты', { net: 14_100, purchases: 3 }],
      ['путешествия', { net: 20_500, purchases: 1 }],
    ]);
    expect([...f.leftOut]).toEqual([[978, 300]]);
  });
});

describe('rankedCategories', () => {
  it('net > 0 only, net desc, a tie by the word', () => {
    const m = new Map([
      ['б', { net: 100, purchases: 1 }],
      ['а', { net: 100, purchases: 2 }],
      ['в', { net: 300, purchases: 1 }],
      ['г', { net: -50, purchases: 0 }],
      ['д', { net: 0, purchases: 0 }],
    ]);
    expect(rankedCategories(m).map(([k]) => k)).toEqual(['в', 'а', 'б']);
  });
});
