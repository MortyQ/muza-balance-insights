// Budget metrics (budget.ts): folding by kind, the 50/30/20 split, fixed and debt shares, the reserve.
import { describe, expect, it } from 'vitest';
import { CATEGORY } from '../../src/derive/categories.ts';
import { budgetSplit, byKind, countStanding, debtShare, fixedShare, guideStanding, incomeStanding, limitsStanding, monthShares, paceStanding, reserveMonths, spendingStanding } from '../../src/read/budget.ts';
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

  it('a month\'s shares: 50 000 income, 22 000 essential, 16 000 wants — left 24%, wants 32%; no income — none', () => {
    const m = new Map<string, number>([[C.groceries, 22_000_00], [C.cafes, 16_000_00], [C.investments, 3_000_00]]);
    expect(monthShares(50_000_00, m, DEFAULT_KINDS)).toEqual({ left: 24, wants: 32 });
    expect(monthShares(0, m, DEFAULT_KINDS)).toBeNull();
  });

  it('standing against a guide: a 5-point band, the reserve near from 2 months', () => {
    expect([20, 18, 15, 14].map((v) => guideStanding('left', v))).toEqual(['within', 'near', 'near', 'outside']);
    expect([50, 51, 55, 56].map((v) => guideStanding('essential', v))).toEqual(['within', 'near', 'near', 'outside']);
    expect([30, 32, 36].map((v) => guideStanding('wants', v))).toEqual(['within', 'near', 'outside']);
    expect([60, 65, 66].map((v) => guideStanding('fixed', v))).toEqual(['within', 'near', 'outside']);
    expect([30, 35, 36].map((v) => guideStanding('debt', v))).toEqual(['within', 'near', 'outside']);
    expect([3, 2.9, 2, 1.5].map((v) => guideStanding('reserve', v))).toEqual(['within', 'near', 'near', 'outside']);
  });

  it('limits: any over is outside, none over but one ahead is near', () => {
    expect(limitsStanding(1, 0)).toBe('outside');
    expect(limitsStanding(0, 1)).toBe('near');
    expect(limitsStanding(0, 0)).toBe('within');
  });

  it('the cushion and spending standings: counts, income and spending against the usual, the pace', () => {
    expect([0, 1, 2].map(countStanding)).toEqual(['within', 'near', 'outside']);
    expect([95, 80, 70].map((n) => incomeStanding(n, 100))).toEqual(['within', 'near', 'outside']);
    expect(incomeStanding(50, 0)).toBeNull();
    expect([100, 110, 111].map((n) => spendingStanding(n, 100))).toEqual(['within', 'near', 'outside']);
    // Day 10 of 30: a third of the month passed.
    expect([33, 43, 45].map((n) => paceStanding(n, 33))).toEqual(['within', 'near', 'outside']);
  });
});
