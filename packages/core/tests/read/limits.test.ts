// Limits (limits.ts): pace, forecast, per day and the state; the suggestion; the budget's fixed rows set aside first.
import { describe, expect, it } from 'vitest';
import { budgetParts, limitState, suggestedAmount } from '../../src/read/limits.ts';

describe('limit figures', () => {
  it('ahead of pace: 1 900 of 4 000 on day 10 of 30 — expected 1 333, forecast 5 700, 100 a day, attention', () => {
    expect(limitState({ amount: 400_000, spent: 190_000, daysPassed: 10, days: 30, period: 'month' })).toEqual({
      spent: 190_000, left: 210_000, percent: 48, expected: 133_333, forecast: 570_000, perDay: 10_000, daysLeft: 21, state: 'attention',
      reason: 'pace', pace: 'ahead', forecastShown: true,
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

  it('too early for a forecast: 12% on day 3 of 30 (10% planned) is on track, ahead in words; a day limit has no forecast', () => {
    expect(limitState({ amount: 400_000, spent: 48_000, daysPassed: 3, days: 30, period: 'month' })).toMatchObject({ state: 'ok', reason: null, pace: 'ahead', forecastShown: false });
    expect(limitState({ amount: 50_000, spent: 30_000, daysPassed: 1, days: 1, period: 'day' })).toMatchObject({ forecast: null, perDay: 20_000, state: 'ok', forecastShown: false });
  });

  it('well ahead in the first days: 6 € of 35 € on day 2 of 30 — attention for the pace, the forecast not shown yet', () => {
    expect(limitState({ amount: 3_500, spent: 600, daysPassed: 2, days: 30, period: 'month' })).toMatchObject({
      expected: 233, state: 'attention', reason: 'pace', pace: 'ahead', forecastShown: false,
    });
    // The budget: 133 € of 1 050 € on day 2 (70 € planned): 1.9 times, 6% of it above.
    expect(limitState({ amount: 105_000, spent: 13_300, daysPassed: 2, days: 30, period: 'month' })).toMatchObject({ state: 'attention', reason: 'pace' });
  });

  it('one early purchase: 60 € on day 1 of a 1 050 € budget (35 € planned) is ahead, not attention', () => {
    expect(limitState({ amount: 105_000, spent: 6_000, daysPassed: 1, days: 30, period: 'month' })).toMatchObject({ state: 'ok', pace: 'ahead', reason: null });
  });

  it('the reason: the forecast after a quarter, then the share; under and even pace; the forecast shown from day 5', () => {
    // Day 10: 36% spent, 33% planned — even, yet the forecast (108%) is over.
    expect(limitState({ amount: 100_000, spent: 36_000, daysPassed: 10, days: 30, period: 'month' })).toMatchObject({ state: 'attention', reason: 'forecast', pace: 'even' });
    // Day 28: 82% spent of 93% planned — under the pace, attention for the share.
    expect(limitState({ amount: 100_000, spent: 82_000, daysPassed: 28, days: 30, period: 'month' })).toMatchObject({ state: 'attention', reason: 'share', pace: 'under' });
    expect(limitState({ amount: 400_000, spent: 50_000, daysPassed: 15, days: 30, period: 'month' })).toMatchObject({ state: 'ok', pace: 'under' });
    expect(limitState({ amount: 100_000, spent: 1_000, daysPassed: 4, days: 30, period: 'month' }).forecastShown).toBe(false);
    expect(limitState({ amount: 100_000, spent: 1_000, daysPassed: 5, days: 30, period: 'month' }).forecastShown).toBe(true);
    expect(limitState({ amount: 10_000, spent: 1_000, daysPassed: 2, days: 7, period: 'week' }).forecastShown).toBe(true);
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
