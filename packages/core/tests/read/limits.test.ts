// Limits (limits.ts): pace, forecast, per day and the state; the suggestion; the budget's fixed rows set aside first.
import { describe, expect, it } from 'vitest';
import { budgetParts, limitState, suggestedAmount } from '../../src/read/limits.ts';

describe('limit figures', () => {
  it('ahead of pace: 1 900 of 4 000 on day 10 of 30 — expected 1 333, forecast 5 700, 100 a day, attention', () => {
    expect(limitState({ amount: 400_000, spent: 190_000, daysPassed: 10, days: 30, period: 'month' })).toEqual({
      spent: 190_000, left: 210_000, percent: 48, expected: 133_333, forecast: 570_000, perDay: 10_000, daysLeft: 21, state: 'attention',
    });
  });

  it('exceeded: 5 300 of 4 000 — left below zero, nothing per day', () => {
    expect(limitState({ amount: 400_000, spent: 530_000, daysPassed: 20, days: 30, period: 'month' })).toMatchObject({ left: -130_000, perDay: 0, state: 'exceeded' });
  });

  it('from 80% spent it needs attention, at 100% still attention, above — exceeded', () => {
    expect(limitState({ amount: 100_000, spent: 79_000, daysPassed: 28, days: 30, period: 'month' }).state).toBe('ok');
    expect(limitState({ amount: 100_000, spent: 80_000, daysPassed: 28, days: 30, period: 'month' }).state).toBe('attention');
    expect(limitState({ amount: 100_000, spent: 100_000, daysPassed: 30, days: 30, period: 'month' }).state).toBe('attention');
    expect(limitState({ amount: 100_000, spent: 100_001, daysPassed: 30, days: 30, period: 'month' }).state).toBe('exceeded');
  });

  it('too early for a forecast: 20% on day 3 of 30 is on track; a day limit has no forecast', () => {
    expect(limitState({ amount: 400_000, spent: 80_000, daysPassed: 3, days: 30, period: 'month' }).state).toBe('ok');
    expect(limitState({ amount: 50_000, spent: 30_000, daysPassed: 1, days: 1, period: 'day' })).toMatchObject({ forecast: null, perDay: 20_000, state: 'ok' });
  });
});

describe('suggested amount', () => {
  it('the median of the whole months, rounded to 100 ₴; a week and a day scaled', () => {
    const months = [390_000, 410_000, 420_000, 430_000, 460_000, 500_000];
    expect(suggestedAmount(months, 'month')).toBe(430_000);
    expect(suggestedAmount(months, 'week')).toBe(100_000);
    expect(suggestedAmount(months, 'day')).toBe(10_000);
  });

  it('none under 3 months or for nothing spent', () => {
    expect(suggestedAmount([400_000, 400_000], 'month')).toBeNull();
    expect(suggestedAmount([0, 0, 0], 'month')).toBeNull();
  });
});

describe('the monthly budget', () => {
  it('2 000 € with rent of 1 250 €: 750 € flexible; rent not paid yet is still set aside', () => {
    expect(budgetParts({ amount: 200_000, fixed: [{ category: 'аренда жилья', amount: 125_000, paid: 0 }], flexibleSpent: 30_000 })).toEqual({
      fixedTotal: 125_000, flexibleAmount: 75_000, flexibleSpent: 30_000, fixedTakesAll: false,
    });
  });

  it('paid more than typed: the 50 above counts against the flexible part', () => {
    expect(budgetParts({ amount: 200_000, fixed: [{ category: 'аренда жилья', amount: 125_000, paid: 130_000 }], flexibleSpent: 30_000 }).flexibleSpent).toBe(35_000);
  });

  it('fixed costs taking the whole total leave nothing flexible', () => {
    expect(budgetParts({ amount: 100_000, fixed: [{ category: 'аренда жилья', amount: 125_000, paid: 0 }], flexibleSpent: 0 })).toMatchObject({ flexibleAmount: 0, fixedTakesAll: true });
  });
});
