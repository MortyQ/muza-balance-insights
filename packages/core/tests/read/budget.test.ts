// Budget metrics (budget.ts): folding by kind, the 50/30/20 split, fixed and debt shares, the reserve.
import { describe, expect, it } from 'vitest';
import { CATEGORY } from '../../src/derive/categories.ts';
import { budgetSplit, byKind, debtShare, fixedShare, reserveMonths } from '../../src/read/budget.ts';
import { DEFAULT_KINDS } from '../../src/read/category-kinds.ts';

const C = CATEGORY;
const month = new Map<string, number>([
  [C.groceries, 30_000_00],
  [C.rent, 15_000_00],
  [C.cafes, 20_000_00],
  [C.entertainment, 5_000_00],
  [C.investments, 5_000_00],
  [C.ownTransfers, 9_000_00],
]);

describe('budget metrics', () => {
  it('folds by kind; fixed counts the fixed categories; a category without a kind is left out', () => {
    expect(byKind(month, DEFAULT_KINDS)).toEqual({ essential: 45_000_00, wants: 25_000_00, savings: 5_000_00, fixed: 15_000_00 });
  });

  it('a month within the guide: 45 / 25 / 30, investments stay in what is left', () => {
    expect(budgetSplit(100_000_00, byKind(month, DEFAULT_KINDS))).toEqual({ essential: 45, wants: 25, left: 30 });
  });

  it('spent more than earned: what is left is negative; no income — no split', () => {
    const t = byKind(month, DEFAULT_KINDS);
    expect(budgetSplit(60_000_00, t)).toEqual({ essential: 75, wants: 42, left: -17 });
    expect(budgetSplit(0, t)).toBeNull();
  });

  it('fixed and debt shares of income', () => {
    expect(fixedShare(100_000_00, byKind(month, DEFAULT_KINDS))).toBe(15);
    expect(debtShare(100_000_00, new Map([[C.installments, 12_000_00]]))).toBe(12);
    expect(debtShare(100_000_00, month)).toBe(0);
    expect(fixedShare(0, byKind(month, DEFAULT_KINDS))).toBeNull();
  });

  it('the reserve: 70 000 at hand over a usual 20 000 essential month is 3.5 months', () => {
    expect(reserveMonths(70_000_00, [18_000_00, 20_000_00, 22_000_00])).toEqual({ months: 3.5, money: 70_000_00, usualEssential: 20_000_00 });
  });

  it('no reserve with fewer than 3 months or a zero median', () => {
    expect(reserveMonths(70_000_00, [20_000_00, 20_000_00])).toBeNull();
    expect(reserveMonths(70_000_00, [0, 0, 0])).toBeNull();
  });
});
