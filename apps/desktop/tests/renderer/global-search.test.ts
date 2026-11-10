// @vitest-environment happy-dom
// The global search (features/global-search in widgets/global-filters, spec desktop-global-search): Cmd/Ctrl+K opens
// it, the input is taken apart into the request, results are grouped, the arrows and Enter open one, the empty state.
// Fictional fixtures only.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { defineComponent, h } from 'vue';
import { createMemoryHistory, createRouter, type Router } from 'vue-router';
import type { PeopleView, SearchOverview, SearchOverviewQuery } from '@contract/api.ts';
import { formatMoney } from '@/shared/lib';

const RATES = { list: [{ currency: 840, rate: 40 }], fetchedAt: 0, saved: false };
const ANSWER: SearchOverview = {
  transactions: [
    { key: 't2', date: '2026-10-12', time: '14:20', merchant: 'Fictional Market', comment: null, category: 'продукты', categoryId: 'groceries', scope: 'personal', participantId: 1, uah: -25_000, currency: 980, amount: -25_000, refund: false },
    { key: 't1', date: '2026-09-03', time: '09:05', merchant: 'Fictional Market', comment: null, category: 'продукты', categoryId: 'groceries', scope: 'personal', participantId: 1, uah: 1_000, currency: 980, amount: 1_000, refund: true },
  ],
  total: 2,
  payees: [{ key: 'fictional market', name: 'Fictional Market', category: 'продукты', categoryId: 'groceries', scope: 'personal', month: '2026-10', lines: 2, net: 24_000 }],
  recurring: [{ key: 'r1', name: 'Fictional Market', category: 'продукты', categoryId: 'groceries', uah: 25_000, currency: 980, amount: 25_000, active: true }],
  rates: RATES,
};

let answer: SearchOverview = ANSWER;
const searchOverview = vi.fn(async (_q: SearchOverviewQuery) => answer);
vi.mock('@/shared/api', () => ({
  balanceApi: { searchOverview: (...a: unknown[]) => searchOverview(...(a as [SearchOverviewQuery])) },
}));

const PEOPLE: PeopleView = {
  people: [{ id: 1, label: 'Сергей', labelFromBank: false, labelPending: false, color: 'blue', connections: [] }],
  secureStorage: true,
};

const blank = defineComponent(() => () => h('div'));
let router: Router;
let w: VueWrapper | null = null;

async function mountSearch() {
  const { i18n } = await import('@/shared/lib/i18n.ts');
  const { useParticipantStore } = await import('@/entities/participant');
  useParticipantStore().view = PEOPLE;
  const { useMonthStore } = await import('@/entities/period');
  const months = useMonthStore();
  vi.spyOn(months, 'today', 'get').mockReturnValue('2026-11-10');
  const { GlobalSearchFeature } = await import('@/features/global-search');
  router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'home', component: blank },
      { path: '/category/:id', name: 'category', component: blank },
      { path: '/recurring', name: 'recurring', component: blank },
    ],
  });
  await router.push('/');
  w = mount(GlobalSearchFeature, { global: { plugins: [i18n, router] }, attachTo: document.body });
  await flushPromises();
  return { months };
}

const input = () => document.body.querySelector<HTMLInputElement>('[data-test="search-input"]');
const items = () => [...document.body.querySelectorAll<HTMLElement>('[data-test="search-item"]')];
const settle = async () => {
  await new Promise((r) => setTimeout(r, 260));
  await flushPromises();
};
async function type(text: string) {
  const el = input()!;
  el.value = text;
  el.dispatchEvent(new Event('input'));
  await settle();
}
const key = async (k: string) => {
  input()!.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));
  await flushPromises();
};
const shortcut = async (o: KeyboardEventInit) => {
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ...o }));
  await flushPromises();
};

beforeEach(() => {
  localStorage.clear();
  setActivePinia(createPinia());
  searchOverview.mockClear();
  answer = ANSWER;
});
afterEach(() => {
  w?.unmount();
  w = null;
  document.body.innerHTML = '';
});

describe('global search', () => {
  it('Cmd+K and Ctrl+K open it with the placeholder; nothing is asked before typing', async () => {
    await mountSearch();
    expect(input()).toBeNull();
    await shortcut({ metaKey: true });
    expect(input()?.placeholder).toBe('Ищи транзакции по названию, сумме или дате');
    expect(document.body.textContent).toContain('Например');
    expect(searchOverview).not.toHaveBeenCalled();
    w!.unmount();
    w = null;
    document.body.innerHTML = '';
    await mountSearch();
    await shortcut({ ctrlKey: true });
    expect(input()).not.toBeNull();
  });

  it('the button opens it too', async () => {
    await mountSearch();
    document.body.querySelector<HTMLElement>('[data-test="search-open"]')!.click();
    await flushPromises();
    expect(input()).not.toBeNull();
  });

  it('text, a date range and an amount reach main as one request in the view; ±1 in the main currency as hryvnia', async () => {
    await mountSearch();
    await shortcut({ metaKey: true });
    await type('Fictional 5–11 жовт 250');
    expect(searchOverview).toHaveBeenCalledTimes(1);
    expect(searchOverview.mock.calls[0]![0]).toEqual({ query: 'Fictional', from: '2026-10-05', to: '2026-10-11', amount: { min: 24_900, max: 25_100 }, participantId: 1 });
    expect(document.body.querySelector('[data-test="search-understood"]')?.textContent).toContain('5 октября – 11 октября');

    const { useCurrencyDisplayStore } = await import('@/entities/currency-display');
    useCurrencyDisplayStore().setMain(840);
    useCurrencyDisplayStore().setRates(RATES);
    await type('10');
    expect(searchOverview.mock.calls.at(-1)![0]).toEqual({ query: '', amount: { min: 36_000, max: 44_000 }, participantId: 1 });
  });

  it('grouped results: transactions, payees, categories by name, regular payments', async () => {
    await mountSearch();
    await shortcut({ metaKey: true });
    await type('продук');
    const groups = [...document.body.querySelectorAll('[data-group]')].map((g) => g.getAttribute('data-group'));
    expect(groups).toEqual(['transactions', 'payees', 'categories', 'recurring']);
    expect(document.body.textContent).toContain('Транзакции');
    expect(document.body.textContent).toContain('Получатели');
    expect(document.body.textContent).toContain('Регулярные платежи');
    expect(items().map((i) => i.textContent)).toContain('Продукты');
    expect(items()[0]!.textContent).toContain(formatMoney(25_000, 980));
    expect(items()[1]!.textContent).toContain(`+${formatMoney(1_000, 980)}`);
  });

  it('arrows and Enter: a transaction opens its category for its month, searched by its text', async () => {
    const { months } = await mountSearch();
    await shortcut({ metaKey: true });
    await type('fictional');
    await key('ArrowDown');
    await key('ArrowDown');
    expect(items()[1]!.getAttribute('aria-selected')).toBe('true');
    await key('ArrowUp');
    await key('Enter');
    await flushPromises();
    expect(router.currentRoute.value.name).toBe('category');
    expect(router.currentRoute.value.params).toEqual({ id: 'groceries' });
    expect(router.currentRoute.value.query).toEqual({ scope: 'personal', q: 'Fictional Market' });
    expect(months.month).toBe('2026-10');
    expect(input()).toBeNull(); // the sheet closed
  });

  it('a payee opens its category with the payee filter; a regular payment the regular payments screen', async () => {
    await mountSearch();
    await shortcut({ metaKey: true });
    await type('fictional');
    items().find((i) => i.closest('[data-group="payees"]'))!.click();
    await flushPromises();
    expect(router.currentRoute.value.query).toEqual({ scope: 'personal', merchant: 'fictional market' });
    await shortcut({ metaKey: true });
    await type('fictional');
    items().find((i) => i.closest('[data-group="recurring"]'))!.click();
    await flushPromises();
    expect(router.currentRoute.value.name).toBe('recurring');
  });

  it('nothing found: «No transactions match “…”»', async () => {
    answer = { transactions: [], total: 0, payees: [], recurring: [], rates: RATES };
    await mountSearch();
    await shortcut({ metaKey: true });
    await type('zzz');
    expect(document.body.querySelector('[data-test="search-empty"]')?.textContent?.trim()).toBe('Ни одна транзакция не подходит под «zzz»');
  });
});
