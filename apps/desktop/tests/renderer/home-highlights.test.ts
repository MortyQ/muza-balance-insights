// @vitest-environment happy-dom
// Home's «What's unusual» / «Recent operations» tile (widgets/home-highlights, spec desktop-home-highlights): the slide
// order, one slide alone, the empty line, rows linked to their category, the home scope, a past month. Fictional fixtures only.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { defineComponent, h } from 'vue';
import { createMemoryHistory, createRouter, type Router } from 'vue-router';
import type { PeopleView, RecentOperations, SpendingInsights, SpendingOverview, SpendingOverviewQuery } from '@contract/api.ts';
import { formatMoney, shiftMonth } from '@/shared/lib';

const INSIGHTS: SpendingInsights = {
  months: 6,
  running: false,
  insights: [
    { type: 'category-less', direction: 'down', amount: 150_000, percent: 50, category: 'продукты', categoryId: 'groceries', now: 150_000, usual: 300_000 },
    { type: 'income-more', direction: 'up', amount: 100_000, percent: 20, category: null, categoryId: null, now: 600_000, usual: 500_000 },
  ],
};
const SPENDING = {
  month: '2026-09',
  period: { from: '2026-09-01', to: '2026-09-30', days: 30, incomplete: false, dataUntil: '2026-10-01', coveredDays: 30, pendingHolds: 0 },
  compare: null,
  total: { net: 0, purchases: 0, prev: null },
  people: [],
  categories: [],
  rates: null,
  leftOut: [],
  familyTotal: null,
  usual: null,
  insights: INSIGHTS,
} as unknown as SpendingOverview;
const RECENT: RecentOperations = {
  month: '2026-09',
  lines: [
    { key: 't2', date: '2026-09-12', time: '14:20', merchant: 'Fictional Cafe', category: 'кафе и рестораны', categoryId: 'cafes', uah: -12_000, currency: 980, amount: -12_000, pending: true, refund: false },
    { key: 't1', date: '2026-09-10', time: '09:05', merchant: '', category: 'продукты', categoryId: 'groceries', uah: 3_000, currency: 980, amount: 3_000, pending: false, refund: true },
  ],
  rates: { list: [{ currency: 978, rate: 40 }], fetchedAt: 0, saved: false },
};

let spending: SpendingOverview = SPENDING;
let recent: RecentOperations = RECENT;
const getSpendingOverview = vi.fn(async (_q: SpendingOverviewQuery) => spending);
const getRecentOperations = vi.fn(async (_q: SpendingOverviewQuery) => recent);
vi.mock('@/shared/api', () => ({
  balanceApi: {
    getSpendingOverview: (...a: unknown[]) => getSpendingOverview(...(a as [SpendingOverviewQuery])),
    getRecentOperations: (...a: unknown[]) => getRecentOperations(...(a as [SpendingOverviewQuery])),
    getLimitsOverview: async () => limits,
  },
}));

// The «Budget» screen's read: limits for the «Limits» slide (none by default).
const fig = (state: 'ok' | 'attention' | 'exceeded', spent: number) => ({
  amount: 100_000, spent, left: 100_000 - spent, percent: spent / 1_000, expected: 50_000, forecast: spent * 2, perDay: 0, daysPassed: 15, days: 30, daysLeft: 16, state, reason: state === 'attention' ? ('forecast' as const) : null, pace: 'even' as const, forecastShown: true, pending: null,
});
const LIMITS = {
  month: '2026-09', today: '2026-09-15', current: true, budget: null, savings: [], jars: [], suggestions: [], kinds: [], rates: null,
  past: { months: [], byCategory: {}, total: [] }, limits: [] as unknown[],
};
let limits = LIMITS;

const PEOPLE: PeopleView = {
  people: [{ id: 1, label: 'Сергей', labelFromBank: false, labelPending: false, color: 'blue', connections: [] }],
  secureStorage: true,
};

let router: Router;

async function mountTile() {
  const { i18n } = await import('@/shared/lib/i18n.ts');
  const { useParticipantStore } = await import('@/entities/participant');
  useParticipantStore().view = PEOPLE;
  const { HomeHighlights } = await import('@/widgets/home-highlights');
  router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'home', component: defineComponent(() => () => h('div')) },
      { path: '/category/:id', name: 'category', component: defineComponent(() => () => h('div')) },
      { path: '/insights', name: 'insights', component: defineComponent(() => () => h('div')) },
      { path: '/budget', name: 'budget', component: defineComponent(() => () => h('div')) },
    ],
  });
  await router.push('/');
  const w = mount(HomeHighlights, { global: { plugins: [i18n, router] }, attachTo: document.body });
  await flushPromises();
  return w;
}

beforeEach(() => {
  localStorage.clear();
  setActivePinia(createPinia());
  getSpendingOverview.mockClear();
  getRecentOperations.mockClear();
  spending = SPENDING;
  recent = RECENT;
  limits = LIMITS;
});

describe('home highlights', () => {
  it('«Limits»: a slide only for limits that need attention — last, or first when one is exceeded', async () => {
    limits = { ...LIMITS, limits: [{ id: 1, categoryId: 'cafes', period: 'month', owner: null, currency: 980, amountMinor: 100_000, figures: fig('attention', 85_000) }] };
    const w = await mountTile();
    expect(w.findAll('.v-carousel__slide').map((s) => s.attributes('data-slide'))).toEqual(['unusual', 'recent', 'limits']);
    w.unmount();
    limits = { ...LIMITS, limits: [{ id: 1, categoryId: 'cafes', period: 'month', owner: null, currency: 980, amountMinor: 100_000, figures: fig('exceeded', 130_000) }] };
    const over = await mountTile();
    expect(over.findAll('.v-carousel__slide').map((s) => s.attributes('data-slide'))).toEqual(['limits', 'unusual', 'recent']);
    expect(over.get('[data-test="attention-limit"]').text()).toContain('Превышено на');
    over.unmount();
    limits = { ...LIMITS, limits: [{ id: 1, categoryId: 'cafes', period: 'month', owner: null, currency: 980, amountMinor: 100_000, figures: fig('ok', 10_000) }] };
    const calm = await mountTile();
    expect(calm.findAll('.v-carousel__slide').map((s) => s.attributes('data-slide'))).toEqual(['unusual', 'recent']);
    calm.unmount();
  });

  it("both: «What's unusual» first, two dots; a dot shows «Recent operations», whose rows open their category", async () => {
    const w = await mountTile();
    const slides = w.findAll('.v-carousel__slide');
    expect(slides.map((s) => s.attributes('data-slide'))).toEqual(['unusual', 'recent']);
    expect(w.get('[data-test="home-highlights"]').classes()).toContain('@[79rem]:col-span-4');
    expect(slides[0]!.text()).toContain(`Продукты — на ${formatMoney(150_000, 980)} (50%) меньше обычного`);
    const dots = w.findAll('[data-test="carousel-dot"]');
    expect(dots.map((d) => d.attributes('aria-label'))).toEqual(['Слайд 1 из 2: Что необычно', 'Слайд 2 из 2: Последние операции']);

    await dots[1]!.trigger('click');
    const rows = w.findAll('[data-test="recent-row"]');
    expect(rows.map((r) => r.text())).toEqual([
      `Fictional CafeКафе и рестораны · 12.09, 14:20 · в обработке банком${formatMoney(12_000, 980)}`,
      `ПродуктыПродукты · 10.09, 09:05+${formatMoney(3_000, 980)}`,
    ]);
    await rows[0]!.trigger('click');
    await flushPromises();
    expect(router.currentRoute.value).toMatchObject({ name: 'category', params: { id: 'cafes' }, query: { scope: 'personal' } });
    w.unmount();
  });

  it('«Recent operations» follow the main currency by the answer\'s rates', async () => {
    spending = { ...SPENDING, insights: null } as unknown as SpendingOverview;
    const { useCurrencyDisplayStore } = await import('@/entities/currency-display');
    useCurrencyDisplayStore().setMain(978);
    const w = await mountTile();
    expect(w.findAll('[data-test="recent-row"]').map((r) => r.text().slice(-12))).toEqual([
      expect.stringContaining(formatMoney(300, 978)),
      expect.stringContaining(`+${formatMoney(75, 978)}`),
    ]);
    w.unmount();
  });

  it('nothing unusual: «Recent operations» alone, no dots', async () => {
    spending = { ...SPENDING, insights: null };
    const w = await mountTile();
    expect(w.findAll('.v-carousel__slide').map((s) => s.attributes('data-slide'))).toEqual(['recent']);
    expect(w.findAll('[data-test="carousel-dot"]')).toHaveLength(0);
    w.unmount();
  });

  it('neither: the tile stays with its no-operations line', async () => {
    spending = { ...SPENDING, insights: null };
    recent = { ...RECENT, lines: [] };
    const w = await mountTile();
    expect(w.find('.v-carousel').exists()).toBe(false);
    expect(w.get('[data-test="highlights-empty"]').text()).toBe('В этом месяце операций пока нет');
    w.unmount();
  });

  it('a past month: «What\'s unusual» alone over the whole row, no recent operations asked; nothing unusual — no tile', async () => {
    const { useMonthStore } = await import('@/entities/period');
    const months = useMonthStore();
    months.set(shiftMonth(months.thisMonth, -1), null);
    const w = await mountTile();
    expect(w.findAll('.v-carousel__slide').map((s) => s.attributes('data-slide'))).toEqual(['unusual']);
    expect(w.get('[data-test="home-highlights"]').classes()).not.toContain('@[79rem]:col-span-4');
    expect(getRecentOperations).not.toHaveBeenCalled();
    w.unmount();

    spending = { ...SPENDING, insights: null };
    const empty = await mountTile();
    expect(empty.find('[data-test="home-highlights"]').exists()).toBe(false);
    empty.unmount();
  });

  it('asks both reads with the home scope, and again when it changes', async () => {
    const w = await mountTile();
    expect(getRecentOperations.mock.calls[0]?.[0]).toMatchObject({ scope: 'personal' });
    const { useScopeStore } = await import('@/entities/scope');
    useScopeStore().scope = 'business';
    await flushPromises();
    expect(getRecentOperations.mock.calls.at(-1)?.[0]).toMatchObject({ scope: 'business' });
    expect(getSpendingOverview.mock.calls.at(-1)?.[0]).toMatchObject({ scope: 'business' });
    w.unmount();
  });
});
