// @vitest-environment happy-dom
// Home's «Insights» block (features/home-insights, spec desktop-home-insights): driver rows linked to their category,
// the savings rate, the note, nothing without a driver or a rate, the home scope. Fictional fixtures only.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { defineComponent, h } from 'vue';
import { createMemoryHistory, createRouter, type Router } from 'vue-router';
import type { PeopleView, SpendingExplain, SpendingOverview, SpendingOverviewQuery } from '@contract/api.ts';
import { formatMoney } from '@/shared/lib';

const EXPLAIN: SpendingExplain = {
  drivers: [
    { category: 'кафе и рестораны', categoryId: 'cafes', name: 'Fictional Cafe', direction: 'up', amount: 150_000, share: 75 },
    { category: 'продукты', categoryId: 'groceries', name: 'Fictional Market', direction: 'down', amount: 40_000, share: 100 },
  ],
  savings: { rate: 34, usual: 37 },
  basis: { months: 5, from: '2025-09', to: '2026-01', pendingHolds: 2 },
};
const SPENDING = { month: '2026-02', insights: null, explain: EXPLAIN } as unknown as SpendingOverview;

let spending: SpendingOverview = SPENDING;
const getSpendingOverview = vi.fn(async (_q: SpendingOverviewQuery) => spending);
vi.mock('@/shared/api', () => ({
  balanceApi: { getSpendingOverview: (...a: unknown[]) => getSpendingOverview(...(a as [SpendingOverviewQuery])) },
}));

const PEOPLE: PeopleView = {
  people: [{ id: 1, label: 'Сергей', labelFromBank: false, labelPending: false, color: 'blue', connections: [] }],
  secureStorage: true,
};

let router: Router;

async function mountBlock() {
  const { i18n } = await import('@/shared/lib/i18n.ts');
  const { useParticipantStore } = await import('@/entities/participant');
  useParticipantStore().view = PEOPLE;
  const { HomeInsightsFeature } = await import('@/features/home-insights');
  router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'home', component: defineComponent(() => () => h('div')) },
      { path: '/category/:id', name: 'category', component: defineComponent(() => () => h('div')) },
      { path: '/insights', name: 'insights', component: defineComponent(() => () => h('div')) },
    ],
  });
  await router.push('/');
  const w = mount(HomeInsightsFeature, { global: { plugins: [i18n, router] }, attachTo: document.body });
  await flushPromises();
  return w;
}

beforeEach(() => {
  setActivePinia(createPinia());
  getSpendingOverview.mockClear();
  spending = SPENDING;
});

describe('home insights block', () => {
  it('driver rows open their category; the savings rate beside the usual; the note with the months and pending holds', async () => {
    const w = await mountBlock();
    expect(w.get('[data-test="home-insights"]').classes()).toEqual(expect.arrayContaining(['col-span-full', '@[79rem]:col-span-5']));
    const rows = w.findAll('[data-test="driver-row"]');
    expect(rows.map((r) => r.text())).toEqual([
      `Fictional CafeКафе и рестораны · 75% изменения+${formatMoney(150_000, 980)}`,
      `Fictional MarketПродукты · 100% изменения−${formatMoney(40_000, 980)}`,
    ]);
    expect(w.get('[data-test="savings-line"]').text()).toBe('Осталось от дохода34%обычно 37%');
    expect(w.get('[data-test="insights-note"]').text()).toContain('медиана за 5 месяцев');
    expect(w.get('[data-test="insights-note"]').text()).toContain('Ещё в обработке банком и учтено: 2 операции');
    await rows[0]!.trigger('click');
    await flushPromises();
    expect(router.currentRoute.value).toMatchObject({ name: 'category', params: { id: 'cafes' }, query: { scope: 'personal' } });
    w.unmount();
  });

  it('spent more than earned: the other title and a minus', async () => {
    spending = { ...SPENDING, explain: { ...EXPLAIN, savings: { rate: -25, usual: 10 } } };
    const w = await mountBlock();
    expect(w.get('[data-test="savings-line"]').text()).toBe('Потрачено больше, чем заработано−25%обычно 10%');
    w.unmount();
  });

  it('no driver and no savings rate: no block, the note alone does not make one', async () => {
    spending = { ...SPENDING, explain: { ...EXPLAIN, drivers: [], savings: null } };
    const w = await mountBlock();
    expect(w.find('[data-test="home-insights"]').exists()).toBe(false);
    w.unmount();
    spending = { ...SPENDING, explain: null };
    const none = await mountBlock();
    expect(none.find('[data-test="home-insights"]').exists()).toBe(false);
    none.unmount();
  });

  it('asks with the home scope, and again when it changes', async () => {
    const w = await mountBlock();
    expect(getSpendingOverview.mock.calls[0]?.[0]).toMatchObject({ scope: 'personal' });
    const { useScopeStore } = await import('@/entities/scope');
    useScopeStore().scope = 'business';
    await flushPromises();
    expect(getSpendingOverview.mock.calls.at(-1)?.[0]).toMatchObject({ scope: 'business' });
    w.unmount();
  });
});
