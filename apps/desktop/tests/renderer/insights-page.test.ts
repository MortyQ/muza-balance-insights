// @vitest-environment happy-dom
// The Insights screen (features/insights-page, spec desktop-insights-page): the month at a glance, the feed ranked with
// severity, bars and drivers, the payee lists, «How it was counted», the calm and early states, the scope. Fictional
// fixtures only; the texts read in Russian (setup-locale).
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { defineComponent, h } from 'vue';
import { createMemoryHistory, createRouter, type Router } from 'vue-router';
import type { InsightCardView, InsightsOverview, PeopleView, SpendingOverviewQuery } from '@contract/api.ts';
import { formatMoney } from '@/shared/lib';

const series = (values: number[], now: number) => [
  ...['2025-09', '2025-10', '2025-11', '2025-12', '2026-01'].map((month, i) => ({ month, value: values[i]! })),
  { month: '2026-02', value: now },
];

const CAFES: InsightCardView = {
  type: 'category-more', direction: 'up', amount: 300_000, percent: 100, category: 'кафе и рестораны', categoryId: 'cafes', now: 600_000, usual: 300_000,
  severity: 'high', series: series([300_000, 280_000, 320_000, 300_000, 300_000], 600_000),
  driver: { name: 'Fictional Cafe', amount: 200_000, share: 67 },
};
const GROCERIES: InsightCardView = {
  type: 'category-less', direction: 'down', amount: 60_000, percent: 25, category: 'продукты', categoryId: 'groceries', now: 180_000, usual: 240_000,
  severity: 'medium', series: series([240_000, 240_000, 230_000, 250_000, 240_000], 180_000), driver: null,
};

const OVERVIEW: InsightsOverview = {
  month: '2026-02',
  period: { from: '2026-02-01', to: '2026-02-28', days: 28, coveredDays: 28, incomplete: false, dataUntil: '2026-02-28', pendingHolds: 2 },
  spent: 1_500_000,
  months: 5,
  cashCounts: true,
  usual: { months: 5, from: '2025-09', to: '2026-01', total: 1_200_000, income: { now: 2_000_000, usual: 2_000_000 }, savings: { rate: 25, usual: 40 } },
  cards: [CAFES, GROCERIES],
  newPayees: [{ name: 'Fictional Studio', category: 'спорт', categoryId: 'sport', amount: 90_000 }],
  oneOffs: [{ key: 't9', date: '2026-02-14', name: '', category: 'маркетплейсы', categoryId: 'marketplaces', amount: 400_000 }],
  limitsOver: [],
  limitsAhead: [],
  budget: {
    month: {
      income: 2_000_000, essential: 900_000, wants: 500_000, savings: 100_000, fixed: 760_000, debt: 160_000,
      split: { essential: 45, wants: 25, left: 30 }, fixedShare: 38, debtShare: 8,
    },
    reserve: { months: 2.4, money: 2_160_000, usualEssential: 900_000 },
    kinds: { essential: ['groceries', 'rent'], wants: ['cafes'], savings: ['investments'], fixed: ['rent'] },
  },
  rates: { list: [{ currency: 978, rate: 50 }], fetchedAt: 0, saved: false },
};

let answer: InsightsOverview = OVERVIEW;
const getInsightsOverview = vi.fn(async (_q: SpendingOverviewQuery) => answer);
vi.mock('@/shared/api', () => ({
  balanceApi: { getInsightsOverview: (...a: unknown[]) => getInsightsOverview(...(a as [SpendingOverviewQuery])) },
}));

const PEOPLE: PeopleView = {
  people: [{ id: 1, label: 'Сергей', labelFromBank: false, labelPending: false, color: 'blue', connections: [] }],
  secureStorage: true,
};

let router: Router;

/** Money is formatted with no-break spaces: compared as plain ones. */
const plain = (s: string) => s.replace(/\s/gu, ' ');

async function mountPage() {
  const { i18n } = await import('@/shared/lib/i18n.ts');
  const { useParticipantStore } = await import('@/entities/participant');
  useParticipantStore().view = PEOPLE;
  const { InsightsFeature } = await import('@/features/insights-page');
  const blank = defineComponent(() => () => h('div'));
  router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'insights', component: blank },
      { path: '/category/:id', name: 'category', component: blank },
      { path: '/income', name: 'income', component: blank },
      { path: '/settings', name: 'settings', component: blank },
      { path: '/budget', name: 'budget', component: blank },
    ],
  });
  await router.push('/');
  const w = mount(InsightsFeature, { global: { plugins: [i18n, router] }, attachTo: document.body });
  await flushPromises();
  return w;
}

beforeEach(() => {
  localStorage.clear();
  setActivePinia(createPinia());
  getInsightsOverview.mockClear();
  answer = OVERVIEW;
});

describe('insights screen', () => {
  it('the month at a glance: spending against the usual, income, the kept share, the signals by severity', async () => {
    const w = await mountPage();
    expect(plain(w.get('[data-test="glance-spent"]').text())).toContain('на 3 000 ₴ (25%) больше обычного (12 000 ₴)');
    expect(w.get('[data-test="glance-income"]').text()).toContain('Примерно как обычно');
    expect(w.get('[data-test="glance-kept"]').text()).toBe('Осталось от дохода25%обычно 40%');
    expect(w.get('[data-test="glance-signals"]').text()).toBe('Сигналы21 высокий · 1 средний');
    w.unmount();
  });

  it('the feed: every card ranked as given, with severity, the change, the bars and the driver; a card opens its category', async () => {
    const w = await mountPage();
    const cards = w.findAll('article');
    expect(cards).toHaveLength(2);
    expect(cards[0]!.get('[data-test="severity"]').text()).toBe('Высокий');
    expect(cards[1]!.get('[data-test="severity"]').text()).toBe('Средний');
    expect(plain(cards[0]!.text())).toContain('+3 000 ₴ (100%)');
    expect(plain(cards[0]!.get('[data-test="insight-driver"]').text())).toBe('В основном Fictional Cafe: +2 000 ₴, 67% изменения');
    expect(cards[1]!.find('[data-test="insight-driver"]').exists()).toBe(false);
    // Six bars, the usual line at 300 000 of 600 000.
    expect(cards[0]!.findAll('[data-test="insight-bars"] [title]')).toHaveLength(6);
    expect(cards[0]!.get('[data-test="usual-line"]').attributes('style')).toContain('bottom: 50%');
    await cards[0]!.get('[data-test="insight-open"]').trigger('click');
    await flushPromises();
    expect(router.currentRoute.value).toMatchObject({ name: 'category', params: { id: 'cafes' }, query: { scope: 'personal' } });
    w.unmount();
  });

  it('the side lists and how it was counted; a one-off without a description shows its category', async () => {
    const w = await mountPage();
    expect(w.get('[data-test="new-payees"]').text()).toContain('Fictional Studio');
    const oneOff = plain(w.get('[data-test="one-offs"] [data-test="signal-row"]').text());
    expect(oneOff).toContain('14 февраля');
    expect(oneOff).toContain('4 000 ₴');
    const basis = w.get('[data-test="insights-basis"]').text();
    expect(basis).toContain('медиана 5 целых месяцев');
    expect(basis).toContain('не учтено, пока банк их не проведёт: 2 транзакции');
    expect(basis).not.toContain('Снятие наличных');
    w.unmount();
    answer = { ...OVERVIEW, cashCounts: false };
    const off = await mountPage();
    expect(off.get('[data-test="insights-basis"]').text()).toContain('Снятие наличных не входит в траты');
    off.unmount();
  });

  it('a forecast above a limit: its card by the overrun, with the forecast and per day, opening the budget; no calm line', async () => {
    answer = {
      ...OVERVIEW,
      limitsAhead: [{ categoryId: null, amount: 3_000_000, spent: 1_900_000, forecast: 3_100_000, over: 100_000, perDay: 70_000, severity: 'medium' }],
    };
    const w = await mountPage();
    // 100 000 over: after the cafes' +300 000, before the groceries' −60 000.
    const cards = w.findAll('article');
    expect(cards).toHaveLength(3);
    const ahead = cards[1]!;
    expect(ahead.text()).toContain('Прогноз выше лимита: бюджет на гибкие траты');
    expect(plain(ahead.text())).toContain(
      `В таком темпе месяц закончится на ${plain(formatMoney(3_100_000, 980))} при лимите ${plain(formatMoney(3_000_000, 980))}. Чтобы уложиться, тратьте не больше ${plain(formatMoney(70_000, 980))} в день.`,
    );
    expect(ahead.get('[data-test="insight-open"]').text()).toContain('Открыть бюджет');
    w.unmount();
    answer = { ...OVERVIEW, cards: [], limitsAhead: answer.limitsAhead };
    const only = await mountPage();
    expect(only.find('[data-test="insights-calm"]').exists()).toBe(false);
    only.unmount();
  });

  it('nothing unusual: a calm line; empty side lists say so', async () => {
    answer = { ...OVERVIEW, cards: [], newPayees: [], oneOffs: [] };
    const w = await mountPage();
    expect(w.find('[data-test="insights-calm"]').exists()).toBe(true);
    expect(w.findAll('article')).toHaveLength(0);
    expect(w.findAll('[data-test="signal-empty"]')).toHaveLength(2);
    expect(w.get('[data-test="glance-signals"]').text()).toContain('Ничего необычного');
    w.unmount();
  });

  it('too little history: the notice with the months there are and a link to the download, no feed', async () => {
    answer = { ...OVERVIEW, months: 2, usual: null, cards: [], newPayees: [], oneOffs: [] };
    const w = await mountPage();
    expect(w.get('[data-test="insights-early"]').text()).toContain('сейчас есть данные за 2 целых месяца');
    expect(w.find('[data-test="insights-basis"]').exists()).toBe(false);
    expect(w.get('[data-test="glance-kept"]').text()).toContain('—');
    w.unmount();
  });

  it('a running month: the meter of a usual month against the month passed; income and the kept share wait', async () => {
    answer = {
      ...OVERVIEW,
      period: { ...OVERVIEW.period, incomplete: true, coveredDays: 7 },
      spent: 600_000,
      usual: { ...OVERVIEW.usual!, income: null, savings: null },
    };
    const w = await mountPage();
    expect(w.get('[data-test="glance-spent"]').text()).toContain('50% обычного месяца · прошло 25% месяца');
    expect(w.get('[data-test="glance-income"]').text()).toContain('Посчитаем, когда месяц закончится');
    expect(w.get('[data-test="insights-basis"]').text()).toContain('Месяц ещё идёт');
    w.unmount();
  });

  it('every amount in the main currency by the answer\'s rates', async () => {
    const { useCurrencyDisplayStore } = await import('@/entities/currency-display');
    useCurrencyDisplayStore().setMain(978);
    const w = await mountPage();
    expect(plain(w.get('[data-test="glance-spent"]').text())).toContain(plain(`(${formatMoney(24_000, 978)})`));
    expect(plain(w.findAll('article')[0]!.text())).toContain(plain(`+${formatMoney(6_000, 978)} (100%)`));
    expect(plain(w.get('[data-test="one-offs"]').text())).toContain(plain(formatMoney(8_000, 978)));
    w.unmount();
  });

  it('a monthly limit over: a «Limit exceeded» card placed among the others by money, opening the budget', async () => {
    answer = { ...OVERVIEW, limitsOver: [{ categoryId: 'cafes', amount: 400_000, spent: 750_000, over: 350_000, severity: 'high' }] };
    const w = await mountPage();
    // 350 000 over outweighs the cafes' +300 000 and the groceries' −60 000: first.
    const cards = w.findAll('article');
    expect(cards).toHaveLength(3);
    const limit = cards[0]!;
    expect(limit.text()).toContain('Лимит превышен: Кафе и рестораны');
    expect(plain(limit.text())).toContain(`Потрачено ${plain(formatMoney(750_000, 980))} при лимите ${plain(formatMoney(400_000, 980))}.`);
    expect(limit.get('[data-test="insight-open"]').text()).toContain('Открыть бюджет');
    w.unmount();
  });

  it('«Budget structure»: the split against 50/30/20, fixed, loans and the reserve, each with its formula in the user\'s numbers', async () => {
    const w = await mountPage();
    const card = w.get('[data-test="budget-structure"]');
    expect(card.get('[data-test="budget-essential"]').text()).toContain('45%');
    expect(card.get('[data-test="budget-left"]').text()).toContain('30%');
    expect(card.get('[data-test="budget-fixed"]').text()).toContain('38%');
    expect(card.get('[data-test="budget-debt"]').text()).toContain('8%');
    expect(card.get('[data-test="budget-reserve"]').text()).toContain('2,4 мес.');
    await card.get('[data-test="budget-left"] button').trigger('click');
    await flushPromises();
    expect(plain(document.body.textContent ?? '')).toContain(plain(`${formatMoney(2_000_000, 980)} − ${formatMoney(900_000, 980)} − ${formatMoney(500_000, 980)} = ${formatMoney(600_000, 980)} (30%)`));
    await card.get('[data-test="budget-kinds"]').trigger('click');
    await flushPromises();
    expect(router.currentRoute.value).toMatchObject({ name: 'settings', query: { section: 'categories' } });
    w.unmount();
  });

  it('«Budget structure» while the month runs: the reserve only, and when the shares come', async () => {
    answer = { ...OVERVIEW, period: { ...OVERVIEW.period, incomplete: true }, budget: { ...OVERVIEW.budget, month: null } };
    const w = await mountPage();
    expect(w.get('[data-test="budget-note"]').text()).toBe('Доли дохода появятся, когда месяц закончится.');
    expect(w.find('[data-test="budget-fixed"]').exists()).toBe(false);
    expect(w.find('[data-test="budget-reserve"]').exists()).toBe(true);
    w.unmount();
  });

  it('«Budget structure» without history: no reserve, and it says why', async () => {
    answer = { ...OVERVIEW, months: 2, usual: null, cards: [], newPayees: [], oneOffs: [], budget: { ...OVERVIEW.budget, reserve: null } };
    const w = await mountPage();
    expect(w.get('[data-test="budget-reserve"]').text()).toContain('Нужны хотя бы 3 целых месяца истории.');
    w.unmount();
  });

  it('asks with the scope, and again when it changes', async () => {
    const w = await mountPage();
    expect(getInsightsOverview.mock.calls[0]?.[0]).toMatchObject({ scope: 'personal' });
    const { useScopeStore } = await import('@/entities/scope');
    useScopeStore().scope = 'business';
    await flushPromises();
    expect(getInsightsOverview.mock.calls.at(-1)?.[0]).toMatchObject({ scope: 'business' });
    w.unmount();
  });
});
