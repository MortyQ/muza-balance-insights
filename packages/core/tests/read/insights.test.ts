// «What's unusual» detectors over fictional sums (kopecks).
import { describe, expect, it } from 'vitest';
import { detectInsights, type InsightInput } from '../../src/read/insights.ts';

const input = (o: Partial<InsightInput> = {}): InsightInput => ({
  months: 6, running: false, now: new Map(), usual: new Map(), income: null, ...o,
});
const types = (o: Partial<InsightInput>) => detectInsights(input(o))!.insights.map((i) => [i.type, i.category, i.amount, i.percent]);

describe('detectInsights', () => {
  it('returns null under three whole months', () => {
    expect(detectInsights(input({ months: 2, now: new Map([['кафе', 900_000]]), usual: new Map([['кафе', 300_000]]) }))).toBeNull();
    expect(detectInsights(input({ months: 3 }))).toEqual({ months: 3, running: false, insights: [] });
  });

  it('needs both the share and the money', () => {
    // +27% but only 400 ₴; +10% though 2 000 ₴.
    expect(types({ now: new Map([['a', 190_000], ['b', 2_200_000]]), usual: new Map([['a', 150_000], ['b', 2_000_000]]) })).toEqual([]);
    expect(types({ now: new Map([['a', 300_000]]), usual: new Map([['a', 200_000]]) })).toEqual([['category-more', 'a', 100_000, 50]]);
    expect(types({ now: new Map([['a', 100_000]]), usual: new Map([['a', 200_000]]) })).toEqual([['category-less', 'a', 100_000, 50]]);
  });

  it('a rare or new category: growth only, no share', () => {
    expect(types({ now: new Map([['new', 80_000], ['rare', 140_000]]), usual: new Map([['rare', 60_000]]) })).toEqual([
      ['category-rare', 'new', 80_000, null],
      ['category-rare', 'rare', 80_000, null],
    ]);
    expect(types({ now: new Map([['rare', 0]]), usual: new Map([['rare', 90_000]]) })).toEqual([]);
    expect(types({ now: new Map([['tiny', 40_000]]) })).toEqual([]);
  });

  it('a running month: only past a whole usual month, no income, no less', () => {
    const o = {
      running: true,
      now: new Map([['a', 700_000], ['b', 100_000]]),
      usual: new Map([['a', 500_000], ['b', 600_000]]),
      income: { now: 0, usual: 5_000_000 },
    };
    expect(types(o)).toEqual([['category-over-month', 'a', 200_000, 40]]);
  });

  it('income by both thresholds', () => {
    expect(types({ income: { now: 6_000_000, usual: 5_000_000 } })).toEqual([['income-more', null, 1_000_000, 20]]);
    expect(types({ income: { now: 4_500_000, usual: 5_000_000 } })).toEqual([]);
    expect(types({ income: { now: 100_000, usual: 0 } })).toEqual([]);
  });

  it('ranks everything by money, ties by category word', () => {
    const r = types({
      now: new Map([['b', 1_200_000], ['c', 600_000], ['a', 600_000]]),
      usual: new Map([['b', 300_000], ['c', 300_000], ['a', 300_000]]),
      income: { now: 2_400_000, usual: 3_000_000 },
    });
    expect(r.map(([t, c]) => [t, c])).toEqual([
      ['category-more', 'b'],
      ['income-less', null],
      ['category-more', 'a'],
      ['category-more', 'c'],
    ]);
  });
});
