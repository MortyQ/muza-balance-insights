// @vitest-environment happy-dom
// Home's «Budget» row (features/home-budget, spec desktop-home-tiles): the four parts of a running month, a past month's
// result, the empty row without a budget, nothing for a past month without one. Fictional data; texts in Russian.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { defineComponent, h } from 'vue';
import { createMemoryHistory, createRouter, type Router } from 'vue-router';
import type { LimitsOverview, PeopleView } from '@contract/api.ts';
import { formatMoney, type YearMonth } from '@/shared/lib';

const plain = (s: string) => s.replace(/\s/gu, ' ');
const uah = (k: number) => plain(formatMoney(k, 980));

const BUDGET: NonNullable<LimitsOverview['budget']> = {
  id: 1, owner: null, currency: 978, amountMinor: 200_000, total: 10_000_000,
  fixed: [{ categoryId: 'rent', amountMinor: 125_000, amount: 6_250_000, paid: 6_250_000 }, { categoryId: 'utilities', amountMinor: 11_000, amount: 550_000, paid: 0 }],
  fixedTotal: 6_800_000, fixedPaid: 6_250_000, fixedTakesAll: false, excluded: [],
  flexible: { amount: 3_200_000, spent: 1_150_000, left: 2_050_000, percent: 36, expected: 1_066_667, forecast: 3_450_000, perDay: 97_619, daysPassed: 10, days: 30, daysLeft: 21, state: 'attention', reason: 'forecast', pace: 'even', forecastShown: true, pending: null },
  result: null,
};
const OVERVIEW: LimitsOverview = {
  month: '2026-11', today: '2026-11-10', current: true, cashCounts: true, budget: BUDGET, limits: [], savings: [], jars: [], suggestions: [],
  past: { months: [], byCategory: {}, total: [] }, kinds: [], rates: { list: [{ currency: 978, rate: 50 }], fetchedAt: 0, saved: false },
};
let answer: LimitsOverview = OVERVIEW;
vi.mock('@/shared/api', () => ({ balanceApi: { getLimitsOverview: async () => answer } }));

const PEOPLE: PeopleView = { people: [{ id: 1, label: 'Сергей', labelFromBank: false, labelPending: false, color: 'blue', connections: [] }], secureStorage: true };
let router: Router;

async function mountRow(month: YearMonth = '2026-11') {
  const { i18n } = await import('@/shared/lib/i18n.ts');
  const { useParticipantStore } = await import('@/entities/participant');
  useParticipantStore().view = PEOPLE;
  const { useMonthStore } = await import('@/entities/period');
  useMonthStore().set(month, null);
  const { HomeBudgetFeature } = await import('@/features/home-budget');
  const blank = defineComponent(() => () => h('div'));
  router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/', name: 'home', component: blank }, { path: '/budget', name: 'budget', component: blank }] });
  await router.push('/');
  const w = mount(HomeBudgetFeature, { global: { plugins: [i18n, router] } });
  await flushPromises();
  return w;
}

beforeEach(() => {
  localStorage.clear();
  setActivePinia(createPinia());
  answer = OVERVIEW;
});

describe('home budget row', () => {
  it('a running month: the total, fixed costs paid, the flexible part with its state, per day by the budget', async () => {
    const w = await mountRow();
    const row = w.get('[data-test="home-budget"]');
    expect(plain(row.text())).toContain(plain(formatMoney(200_000, 978)));
    expect(plain(row.get('[data-test="home-budget-fixed"]').text())).toContain(`оплачено ${uah(6_250_000)} из ${uah(6_800_000)}`);
    expect(row.get('[data-test="home-budget-fixed"]').text()).toContain('Аренда жилья ✓');
    expect(row.get('[data-test="limit-state"]').text()).toBe('Прогноз выше лимита');
    expect(plain(row.get('[data-test="home-budget-day"]').text())).toBe(`Можно в день по бюджету${uah(97_619)}ещё 21 день`);
    await row.trigger('click');
    await flushPromises();
    expect(router.currentRoute.value.name).toBe('budget');
  });

  it('«Show also» hryvnia with euros main: a line under the total, the fixed and flexible parts and per day', async () => {
    const { useCurrencyDisplayStore } = await import('@/entities/currency-display');
    useCurrencyDisplayStore().setMain(978);
    useCurrencyDisplayStore().setAlso('uah', true);
    const w = await mountRow();
    expect(w.findAll('[data-test="money-also"]').map((x) => plain(x.text()))).toEqual([
      `≈ ${uah(10_000_000)}`,
      `≈ ${uah(6_250_000)} из ${uah(6_800_000)}`,
      `≈ ${uah(1_150_000)} из ${uah(3_200_000)}`,
      `≈ ${uah(97_619)}`,
    ]);
    // The budget's own currency is not repeated.
    useCurrencyDisplayStore().setAlso('uah', false);
    useCurrencyDisplayStore().setMain(980);
    useCurrencyDisplayStore().setAlso('eur', true);
    await flushPromises();
    expect(w.findAll('[data-test="money-also"]')).toHaveLength(3);
  });

  it('pending holds of the flexible part: a quiet note under the bar', async () => {
    answer = { ...OVERVIEW, budget: { ...BUDGET, flexible: { ...BUDGET.flexible, pending: { count: 3, amount: 120_000 } } } };
    const w = await mountRow();
    expect(plain(w.get('[data-test="home-budget-flexible"] [data-test="pending-note"]').text())).toBe(`в т.ч. 3 в ожидании, ${uah(120_000)}`);
  });

  it('the exclusions are named under the flexible part; none, no line', async () => {
    const w = await mountRow();
    expect(w.find('[data-test="home-budget-excluded"]').exists()).toBe(false);
    w.unmount();
    answer = { ...OVERVIEW, budget: { ...BUDGET, excluded: ['taxes', 'travel'] } };
    const named = await mountRow();
    expect(named.get('[data-test="home-budget-flexible"] [data-test="home-budget-excluded"]').text()).toBe('Не учитывается: Налоги и госплатежи, Путешествия и отпуск');
  });

  it('a past month: the result instead of the pace', async () => {
    answer = { ...OVERVIEW, current: false, budget: { ...BUDGET, result: { within: true, left: 285_000 } } };
    const w = await mountRow('2026-10');
    expect(w.get('[data-test="home-budget-result"]').text()).toBe('Уложились');
    expect(plain(w.get('[data-test="home-budget-day"]').text())).toBe(`Осталось${uah(285_000)}`);
  });

  it('no budget in the current month: the empty row opens the budget sheet; a past month without one: nothing', async () => {
    answer = { ...OVERVIEW, budget: null };
    const w = await mountRow();
    expect(w.find('[data-test="home-budget-empty"]').exists()).toBe(true);
    await w.get('[data-test="home-budget-set"]').trigger('click');
    await flushPromises();
    expect(router.currentRoute.value).toMatchObject({ name: 'budget', query: { sheet: 'budget' } });
    answer = { ...OVERVIEW, current: false, budget: null };
    const past = await mountRow('2026-10');
    expect(past.find('[data-test="home-budget-empty"]').exists()).toBe(false);
    expect(past.find('[data-test="home-budget"]').exists()).toBe(false);
  });
});
