// «What's unusual» detectors over fictional sums (kopecks).
import { describe, expect, it } from 'vitest';
import { detectInsights, insightSeverity, mainDriver, newPayees, oneOffs, payeeUsual, savingsRate, SIGNALS_MAX, type InsightInput } from '../../src/read/insights.ts';

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

describe('mainDriver', () => {
  const p = (name: string, now: number, months: number[]) => ({ name, now, months });

  it('the payee furthest in the direction of the change, with its share', () => {
    // Category +200 000: one payee +150 000 over its median, another +50 000.
    expect(mainDriver(200_000, [p('Cafe B', 80_000, [30_000, 30_000, 30_000]), p('Cafe A', 250_000, [100_000, 90_000, 110_000])])).toEqual({
      name: 'Cafe A', amount: 150_000, share: 75,
    });
  });

  it('a drop: the payee that fell the most, never one that grew', () => {
    expect(mainDriver(-100_000, [p('Up', 200_000, [50_000, 50_000, 50_000]), p('Down', 0, [80_000, 80_000, 70_000])])).toEqual({
      name: 'Down', amount: 80_000, share: 80,
    });
  });

  it('none under the share, none for no change; the share is capped and ties go by name', () => {
    expect(mainDriver(100_000, [p('a', 20_000, [0, 0, 0]), p('b', 20_000, [0, 0, 0])])).toBeNull();
    expect(mainDriver(0, [p('a', 50_000, [0, 0, 0])])).toBeNull();
    expect(mainDriver(100_000, [p('b', 150_000, [0, 0, 0]), p('a', 150_000, [0, 0, 0])])).toEqual({ name: 'a', amount: 150_000, share: 100 });
    // Even count: the median is the mean of the middle two.
    expect(mainDriver(100_000, [p('a', 100_000, [0, 20_000, 40_000, 100_000])])).toEqual({ name: 'a', amount: 70_000, share: 70 });
  });
});

describe('savingsRate', () => {
  const m = (income: number, spent: number) => ({ income, spent });

  it('the month beside the median of months with income', () => {
    expect(savingsRate(m(100_000, 70_000), [m(100_000, 80_000), m(0, 50_000), m(100_000, 90_000), m(100_000, 60_000)])).toEqual({ rate: 30, usual: 20 });
  });

  it('negative when more was spent than earned', () => {
    expect(savingsRate(m(100_000, 125_000), [m(100_000, 80_000), m(100_000, 80_000), m(100_000, 80_000)])!.rate).toBe(-25);
  });

  it('none without income or with fewer than three months with income', () => {
    expect(savingsRate(m(0, 10_000), [m(100_000, 80_000), m(100_000, 80_000), m(100_000, 80_000)])).toBeNull();
    expect(savingsRate(m(100_000, 10_000), [m(100_000, 80_000), m(0, 80_000), m(100_000, 80_000)])).toBeNull();
  });
});

describe('insightSeverity', () => {
  it('weighs a difference against a usual month', () => {
    expect(insightSeverity(300_000, 2_000_000)).toBe('high');
    expect(insightSeverity(200_000, 2_000_000)).toBe('high');
    expect(insightSeverity(100_000, 2_000_000)).toBe('medium');
    expect(insightSeverity(50_000, 2_000_000)).toBe('low');
    expect(insightSeverity(50_000, 0)).toBe('low');
  });
});

describe('newPayees', () => {
  const p = (name: string, now: number, months: number[]) => ({ name, now, months });

  it('only payees with nothing before and at least the minimum now, largest first', () => {
    const r = newPayees([
      p('Shop Seen', 900_000, [0, 10_000, 0]),
      p('Shop Small', 30_000, [0, 0, 0]),
      p('Shop B', 60_000, [0, 0, 0]),
      p('Shop A', 60_000, [0, 0, 0]),
      p('Shop Big', 200_000, [0, 0, 0]),
    ]);
    expect(r.map((x) => x.name)).toEqual(['Shop Big', 'Shop A', 'Shop B']);
  });

  it('keeps at most SIGNALS_MAX', () => {
    const many = Array.from({ length: SIGNALS_MAX + 3 }, (_, i) => p(`Shop ${String(i).padStart(2, '0')}`, 100_000 + i, [0, 0, 0]));
    expect(newPayees(many)).toHaveLength(SIGNALS_MAX);
  });
});

describe('oneOffs', () => {
  const o = (key: string, amount: number, usual: number) => ({ key, amount, payeeUsual: usual });

  it('a large operation to a payee that does not usually take half of it', () => {
    // Usual month 2 000 000: the bar is 200 000.
    const r = oneOffs([o('rent', 1_500_000, 1_500_000), o('sofa', 400_000, 0), o('small', 150_000, 0), o('repair', 400_000, 150_000), o('b', 250_000, 0)], 2_000_000);
    expect(r.map((x) => x.key)).toEqual(['repair', 'sofa', 'b']);
  });

  it('never below the money minimum', () => {
    expect(oneOffs([o('x', 40_000, 0)], 100_000)).toEqual([]);
  });

  it('payeeUsual is the median of the months', () => {
    expect(payeeUsual({ name: 'x', now: 0, months: [0, 100, 300] })).toBe(100);
  });
});
