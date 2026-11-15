// @vitest-environment happy-dom
// A limit's look (entities/goal limitLook, spec desktop-limits-goals «The state in words says the real problem»): the
// state said by its reason, a small lead never «On track», the forecast only once it is shown. Fictional data only;
// the texts read in Russian (setup-locale).
import { describe, expect, it } from 'vitest';
import type { LimitFiguresView } from '@contract/api.ts';
import { mount } from '@vue/test-utils';
import { LimitBar, limitLook, STATE_LOOK } from '@/entities/goal';
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
  it('6 € of 35 € on day 2: «ahead of plan» with the times, the «well ahead» look (over twice the plan), no forecast yet', () => {
    const look = limitLook(fig(600, 2, { state: 'attention', reason: 'pace', pace: 'ahead' }), money, true);
    expect(look.state).toBe('strong');
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

  // 35 € a month, day 10 of 30: 1 167 expected by today.
  it('«well ahead» (strong): attention by pace from twice the plan, by the forecast from one and a half limits', () => {
    const atTwice = limitLook(fig(2_334, 10, { state: 'attention', reason: 'pace', pace: 'ahead', forecast: 2_900 }), money, true);
    expect(atTwice.state).toBe('strong');
    expect(plain(atTwice.stateText)).toBe(`Быстрее плана на ${eur(1_167)} (×2,0)`);
    expect(atTwice.stateIcon).toBe(STATE_LOOK.attention.icon);
    expect(limitLook(fig(2_333, 10, { state: 'attention', reason: 'pace', pace: 'ahead', forecast: 2_900 }), money, true).state).toBe('attention');
    expect(limitLook(fig(1_750, 10, { state: 'attention', reason: 'forecast', forecast: 5_250 }), money, true).state).toBe('strong');
    expect(limitLook(fig(1_750, 10, { state: 'attention', reason: 'forecast', forecast: 5_249 }), money, true).state).toBe('attention');
    // A forecast not shown yet (day 3) or a past month never makes it strong.
    expect(limitLook(fig(900, 3, { state: 'attention', reason: 'share', forecast: 9_000, forecastShown: false }), money, true).state).toBe('attention');
    expect(limitLook(fig(1_750, 10, { state: 'attention', reason: 'share', forecast: 9_000 }), money, false).state).toBe('attention');
    // Only attention: an on-track or exceeded state keeps its own look.
    expect(limitLook(fig(4_000, 10, { state: 'exceeded', reason: null, forecast: 12_000 }), money, true).state).toBe('exceeded');
  });

  it('past the limit: the scale is what was spent — the limit solid, the rest over, the pace on the same scale', () => {
    const look = limitLook(fig(5_250, 15, { state: 'exceeded', reason: null }), money, true);
    expect(look.fill).toBeCloseTo(66.667, 2);
    expect(look.over).toBeCloseTo(33.333, 2);
    expect(look.pace).toBeCloseTo(33.333, 2);
    // Not exceeded: unchanged — spent of the amount, nothing over.
    const held = limitLook(fig(1_750, 15, { pace: 'even' }), money, true);
    expect([held.fill, held.over, held.pace]).toEqual([50, 0, 50]);
    // Exactly at the limit is not past it.
    const exact = limitLook(fig(3_500, 30, { state: 'exceeded', reason: null }), money, false);
    expect([exact.fill, exact.over]).toEqual([100, 0]);
  });

  it('the bar: a hatched part and a tick at the limit only when over; the strong look has its own colour', () => {
    const plainBar = mount(LimitBar, { props: { fill: 50, state: 'ok' } });
    expect(plainBar.find('[data-test="limit-over"]').exists()).toBe(false);
    expect(plainBar.find('[data-test="limit-tick"]').exists()).toBe(false);
    const past = mount(LimitBar, { props: { fill: 62.5, over: 37.5, pace: 30, state: 'exceeded' } });
    expect(past.get('[data-test="limit-over"]').attributes('style')).toContain('width: 37.5%');
    expect(past.get('[data-test="limit-tick"]').attributes('style')).toContain('left: 62.5%');
    expect(past.get('[data-test="pace-marker"]').attributes('style')).toContain('left: 30%');
    expect(STATE_LOOK.strong.fill).toBe('var(--warning-strong)');
    expect(mount(LimitBar, { props: { fill: 50, state: 'strong' } }).html()).toContain('var(--warning-strong)');
  });
});
