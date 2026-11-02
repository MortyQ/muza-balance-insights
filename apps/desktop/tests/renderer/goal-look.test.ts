// @vitest-environment happy-dom
// A limit's look (entities/goal limitLook, spec desktop-limits-goals «The state in words says the real problem»): the
// state said by its reason, a small lead never «On track», the forecast only once it is shown. Fictional data only;
// the texts read in Russian (setup-locale).
import { describe, expect, it } from 'vitest';
import type { LimitFiguresView } from '@contract/api.ts';
import { limitLook } from '@/entities/goal';
import { formatMoney } from '@/shared/lib';

const plain = (s: string) => s.replace(/\s/gu, ' ');
const money = { money: (k: number) => formatMoney(k, 978) };
const eur = (k: number) => plain(formatMoney(k, 978));

/** A 35 € monthly limit on a day of a 30-day month. */
const fig = (spent: number, daysPassed: number, over: Partial<LimitFiguresView>): LimitFiguresView => ({
  amount: 3_500, spent, left: 3_500 - spent, percent: Math.round((spent / 3_500) * 100), expected: Math.round((3_500 * daysPassed) / 30),
  forecast: Math.round((spent / daysPassed) * 30), perDay: Math.round((3_500 - spent) / (31 - daysPassed)), daysPassed, days: 30, daysLeft: 31 - daysPassed,
  state: 'ok', reason: null, pace: 'even', forecastShown: daysPassed >= 5, pending: null, ...over,
});

describe('limit look', () => {
  it('6 € of 35 € on day 2: «ahead of plan» with the times, the attention look, no forecast yet', () => {
    const look = limitLook(fig(600, 2, { state: 'attention', reason: 'pace', pace: 'ahead' }), money, true);
    expect(look.state).toBe('attention');
    expect(plain(look.stateText)).toBe(`Быстрее плана на ${eur(367)} (×2,6)`);
    expect(plain(look.paceText)).toBe(`к сегодня по плану ${eur(233)}`);
    expect(look.help.forecast).toBeNull();
  });

  it('a small lead is not «On track»: a neutral look in words', () => {
    const look = limitLook(fig(300, 2, { pace: 'ahead' }), money, true);
    expect(look.state).toBe('ahead');
    expect(look.stateText).toBe('Чуть быстрее плана');
  });

  it('under the plan says by how much; the forecast once shown; the forecast and share reasons', () => {
    const under = limitLook(fig(500, 15, { pace: 'under' }), money, true);
    expect(under.state).toBe('ok');
    expect(plain(under.stateText)).toBe(`Ниже плана на ${eur(1_250)}`);
    expect(plain(under.paceText)).toContain('прогноз');
    expect(limitLook(fig(1_900, 15, { state: 'attention', reason: 'forecast' }), money, true).stateText).toBe('Прогноз выше лимита');
    expect(limitLook(fig(2_900, 28, { state: 'attention', reason: 'share' }), money, true).stateText).toBe('Потрачено 83%');
    // A past month: no pace words.
    expect(limitLook(fig(500, 30, { pace: 'under' }), money, false).stateText).toBe('В темпе');
  });
});
