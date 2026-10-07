// The spending block's «usual» in main (usual.ts): which months, the medians.
import { describe, expect, it } from 'vitest';
import { usualMonths, usualOf } from '../src/main/usual.ts';

describe('usual', () => {
  it('the covered months before, newest first, at most 6; none without data', () => {
    expect(usualMonths('2026-03', '2025-01-01')).toEqual(['2026-02', '2026-01', '2025-12', '2025-11', '2025-10', '2025-09']);
    expect(usualMonths('2026-03', '2025-12-15')).toEqual(['2026-02', '2026-01']);
    expect(usualMonths('2026-03', null)).toEqual([]);
  });

  it('medians per category (missing = 0, a zero median left out) and of the totals; fewer than 3 months — none', () => {
    const m = (o: Record<string, number>) => new Map(Object.entries(o));
    const u = usualOf([m({ a: 100, b: 10 }), m({ a: 300 }), m({ a: 200, b: 20 }), m({ a: 400, c: 5 })]);
    expect(u).toEqual({ total: 260, byCategory: new Map([['a', 250], ['b', 5]]) });
    expect(usualOf([m({ a: 1 }), m({ a: 2 })])).toBeNull();
  });
});
