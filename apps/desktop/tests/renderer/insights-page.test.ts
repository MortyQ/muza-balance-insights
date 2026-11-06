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
  newPayees: [{ name: 'Fictional Studio', category: 'спорт', categoryId: 'sport', amount: 90_000, severity: 'low' }],
  oneOffs: [{ key: 't9', date: '2026-02-14', name: '', category: 'маркетплейсы', categoryId: 'marketplaces', amount: 400_000, severity: 'high' }],
  limitsOver: [],
  limitsAhead: [],
  monthlyLimits: 0,
  standing: { left: 'within', essential: 'within', wants: 'within', fixed: 'within', debt: 'within', reserve: 'near', limits: null },
  // The user's own references (fictional): September … February with November without income.
  health: {
    chart: {
      left: { usual: 22, unusual: [null, null, null, null, null, 'below'], trend: { now: 11, before: 24, direction: 'worse' } },
      wants: { usual: 28, unusual: [null, null, null, null, null, 'above'], trend: { now: 36, before: 28, direction: 'worse' } },
    },
    versus: {
      left: { usual: 24, direction: 'better' },
      essential: { usual: 45, direction: 'same' },
      wants: { usual: 28, direction: 'better' },
      fixed: { usual: 38, direction: 'same' },
      debt: { usual: 8, direction: 'same' },
    },
    forecast: null,
    redMonths: { n: 1, of: 5, standing: 'near' },
    income: { now: 2_000_000, usual: 2_000_000, standing: 'within' },
    spending: { kind: 'month', now: 1_500_000, usual: 1_200_000, standing: 'outside' },
    strong: { n: 2, standing: 'outside' },
  },
  history: [
    { month: '2025-09', left: 22, wants: 28, leftStanding: 'within', wantsStanding: 'within' },
    { month: '2025-10', left: 25, wants: 27, leftStanding: 'within', wantsStanding: 'within' },
    { month: '2025-11', left: null, wants: null, leftStanding: null, wantsStanding: null },
    { month: '2025-12', left: 19, wants: 31, leftStanding: 'near', wantsStanding: 'near' },
    { month: '2026-01', left: 27, wants: 26, leftStanding: 'within', wantsStanding: 'within' },
    { month: '2026-02', left: -12, wants: 52, leftStanding: 'outside', wantsStanding: 'outside' },
  ],
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
    // Every feed item counts: two cards, the one-off (high) and the new payee (low).
    const signals = w.get('[data-test="glance-signals"]');
    expect(signals.text()).not.toContain('·');
    expect(signals.findAll('[data-test="signals-count"]').map((c) => c.text())).toEqual(['2 высоких', '1 средний', '1 низкий']);
    expect(signals.get('[data-test="signals-bar"]').findAll('span').map((p) => p.attributes('style'))).toEqual(['flex-grow: 2;', 'flex-grow: 1;', 'flex-grow: 1;']);
    expect(signals.text()).toMatch(/^Сигналы4/);
    w.unmount();
  });

  it('the signals figure: only low items — one part; no usual — the dash and no bar', async () => {
    answer = { ...OVERVIEW, cards: [{ ...GROCERIES, severity: 'low' }], oneOffs: [] };
    const w = await mountPage();
    const signals = w.get('[data-test="glance-signals"]');
    expect(signals.findAll('[data-test="signals-count"]').map((c) => c.text())).toEqual(['2 низких']);
    w.unmount();
    answer = { ...OVERVIEW, usual: null, cards: [], newPayees: [], oneOffs: [] };
    const early = await mountPage();
    expect(early.find('[data-test="signals-bar"]').exists()).toBe(false);
    expect(early.get('[data-test="glance-signals"]').text()).toContain('—');
    early.unmount();
  });

  it('the feed: every item ranked by money, a one-off and a new payee among the cards', async () => {
    const w = await mountPage();
    const items = w.findAll('article').map((a) => a.attributes('data-test'));
    // 400 000 one-off, cafes +300 000, the new payee 90 000, groceries −60 000.
    expect(items).toEqual(['signal-card-high', 'insight-card-high', 'signal-card-low', 'insight-card-medium']);
    const oneOff = plain(w.findAll('article')[0]!.text());
    expect(oneOff).toContain('Разовый платёж · 14 февраля · Маркетплейсы');
    expect(oneOff).toContain('4 000 ₴');
    expect(w.findAll('article')[2]!.text()).toContain('Fictional Studio');
    w.unmount();
  });

  it('a card: severity, the change, the bars and the driver; it opens its category', async () => {
    const w = await mountPage();
    const cards = w.findAll('[data-test^="insight-card"]');
    expect(cards).toHaveLength(2);
    expect(cards[0]!.get('[data-test="severity"]').text()).toBe('Высокий');
    expect(cards[1]!.get('[data-test="severity"]').text()).toBe('Средний');
    expect(plain(cards[0]!.text())).toContain('+3 000 ₴ (×2,0)');
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

  it('how it was counted, the payee signals\' thresholds included', async () => {
    const w = await mountPage();
    const basis = w.get('[data-test="insights-basis"]').text();
    expect(basis).toContain('медиана 5 целых месяцев');
    expect(basis).toContain('не учтено, пока банк их не проведёт: 2 транзакции');
    expect(basis).not.toContain('Снятие наличных');
    expect(basis).toContain('Новые получатели: впервые в этом месяце');
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
    const cards = w.findAll('[data-test^="insight-card"]');
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

  it('nothing unusual: a calm line and no filters', async () => {
    answer = { ...OVERVIEW, cards: [], newPayees: [], oneOffs: [] };
    const w = await mountPage();
    expect(w.find('[data-test="insights-calm"]').exists()).toBe(true);
    expect(w.findAll('article')).toHaveLength(0);
    expect(w.find('[data-test="feed-filters"]').exists()).toBe(false);
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
    expect(plain(w.findAll('[data-test^="insight-card"]')[0]!.text())).toContain(plain(`+${formatMoney(6_000, 978)} (×2,0)`));
    expect(plain(w.get('[data-test="signal-card-high"]').text())).toContain(plain(formatMoney(8_000, 978)));
    w.unmount();
  });

  it('a monthly limit over: a «Limit exceeded» card placed among the others by money, opening the budget', async () => {
    answer = { ...OVERVIEW, limitsOver: [{ categoryId: 'cafes', amount: 400_000, spent: 750_000, over: 350_000, severity: 'high' }] };
    const w = await mountPage();
    // 350 000 over outweighs the cafes' +300 000 and the groceries' −60 000: first of the cards.
    const cards = w.findAll('[data-test^="insight-card"]');
    expect(cards).toHaveLength(3);
    const limit = cards[0]!;
    expect(limit.text()).toContain('Лимит превышен: Кафе и рестораны');
    expect(plain(limit.text())).toContain(`Потрачено ${plain(formatMoney(750_000, 980))} при лимите ${plain(formatMoney(400_000, 980))}.`);
    expect(limit.get('[data-test="insight-open"]').text()).toContain('Открыть бюджет');
    w.unmount();
  });

  it('«Financial health»: what is left of income as bars, said in plain words; below zero explained; the chart in words', async () => {
    const w = await mountPage();
    const chart = w.get('[data-test="shares-chart"]');
    expect(chart.get('[data-test="shares-title"]').text()).toBe('Сколько остаётся от дохода');
    // February spent more than came in: the sentence says so instead of «−12%» alone.
    expect(chart.get('[data-test="shares-latest"]').text()).toBe('−12%');
    expect(chart.get('[data-test="shares-latest"]').classes()).toContain('text-danger');
    expect(chart.get('[data-test="shares-sentence"]').text()).toBe('Февраль — траты больше дохода');
    // The first month with income, September, five months before.
    expect(chart.get('[data-test="shares-before"]').text()).toBe('5 мес. назад: 22%');
    expect(chart.text()).not.toContain('п.п.');
    expect(chart.get('[data-test="shares-legend"]').text()).toContain('от 20% — в ориентире');
    expect(chart.get('[data-test="shares-legend"]').text()).toContain('15–19% — близко');
    expect(chart.get('[data-test="shares-below-zero"]').text()).toBe('Ниже нуля — месяц, когда потратили больше, чем заработали.');
    const label = chart.get('[data-test="shares-plot"]').attributes('aria-label')!;
    expect(label).toContain('Сколько остаётся от дохода по месяцам:');
    expect(label).toContain('2025 — без дохода');
    expect(label).toContain('2026 — −12%');
    w.unmount();
  });

  it('«Financial health»: the switch shows what goes on wants against 30%', async () => {
    const w = await mountPage();
    const chart = w.get('[data-test="shares-chart"]');
    const wants = chart.get('[data-test="shares-switch"]').findAll('button').find((b) => b.text().includes('Желательные'))!;
    await wants.trigger('click');
    await flushPromises();
    expect(chart.get('[data-test="shares-title"]').text()).toBe('Сколько уходит на желательное');
    expect(chart.get('[data-test="shares-sentence"]').text()).toBe('Февраль — на желательное ушло 52% дохода');
    expect(chart.get('[data-test="shares-before"]').text()).toBe('5 мес. назад: 28%');
    expect(chart.get('[data-test="shares-legend"]').text()).toContain('31–35% — близко');
    expect(chart.find('[data-test="shares-below-zero"]').exists()).toBe(false);
    expect(chart.text()).toContain('ориентир 30%');
    w.unmount();
  });

  it('the checklist: each figure with its guide and standing in words; the income bar; the formula on «?»; the kinds link', async () => {
    const w = await mountPage();
    const list = w.get('[data-test="health-checklist"]');
    expect(list.find('[data-test="health-bar"]').exists()).toBe(true);
    const row = (k: string) => list.get(`[data-test="health-${k}"]`);
    expect(row('left').text()).toContain('30%');
    expect(row('left').text()).toContain('от 20%');
    expect(row('essential').text()).toContain('45%');
    expect(row('fixed').text()).toContain('38%');
    expect(row('debt').text()).toContain('8%');
    expect(row('reserve').text()).toContain('2,4 мес.');
    expect(row('reserve').get('[data-test="health-standing"]').text()).toBe(', близко к ориентиру');
    expect(row('left').get('[data-test="health-standing"]').text()).toBe(', в ориентире');
    expect(list.find('[data-test="health-limits"]').exists()).toBe(false);
    expect(list.get('[data-test="health-count"]').text()).toBe('6 из 10');
    expect(list.text()).not.toMatch(/хорош|плох/i);
    await row('left').get('button').trigger('click');
    await flushPromises();
    expect(plain(document.body.textContent ?? '')).toContain(plain(`${formatMoney(2_000_000, 980)} − ${formatMoney(900_000, 980)} − ${formatMoney(500_000, 980)} = ${formatMoney(600_000, 980)} (30%)`));
    await list.get('[data-test="budget-kinds"]').trigger('click');
    await flushPromises();
    expect(router.currentRoute.value).toMatchObject({ name: 'settings', query: { section: 'categories' } });
    w.unmount();
  });

  it('the checklist in three groups, each share beside the user\'s usual of it, the cushion and spending items', async () => {
    const w = await mountPage();
    const groups = w.findAll('[data-test^="health-group-"]');
    expect(groups.map((g) => g.find('h4').text())).toEqual(['Этот месяц', 'Запас прочности', 'Траты и планы']);
    expect(w.get('[data-test="health-group-cushion"]').findAll('li').map((l) => l.attributes('data-test'))).toEqual(['health-reserve', 'health-red', 'health-income']);
    expect(w.get('[data-test="health-group-plans"]').findAll('li').map((l) => l.attributes('data-test'))).toEqual(['health-spending', 'health-strong']);
    expect(w.get('[data-test="health-left"] [data-test="health-direction"]').text()).toBe('лучше обычного (24%)');
    expect(w.get('[data-test="health-essential"] [data-test="health-direction"]').text()).toBe('как обычно');
    expect(w.get('[data-test="health-red"]').text()).toContain('1 из 5');
    expect(w.get('[data-test="health-income"]').text()).toContain('100% обычного');
    expect(w.get('[data-test="health-spending"]').text()).toContain('125% обычного');
    expect(w.get('[data-test="health-spending"] [data-test="health-standing"]').text()).toBe(', вне ориентира');
    w.unmount();
  });

  it('«Strong signals» → «Show» filters the feed to the high items', async () => {
    const w = await mountPage();
    expect(w.get('[data-test="health-strong"]').text()).toContain('2');
    await w.get('[data-test="health-show-signals"]').trigger('click');
    await flushPromises();
    expect(w.get('[data-test="filter-severity-high"]').attributes('aria-pressed')).toBe('true');
    expect(w.findAll('article').map((a) => a.attributes('data-test'))).toEqual(['signal-card-high', 'insight-card-high']);
    w.unmount();
  });

  it('the chart\'s references: the usual and its range, an unusual month in words, three tiles', async () => {
    const w = await mountPage();
    const chart = w.get('[data-test="shares-chart"]');
    expect(chart.get('[data-test="shares-usual"]').text()).toBe('обычно 22%');
    expect(chart.get('[data-test="shares-references"]').text()).toContain('твоё обычное');
    expect(chart.get('[data-test="shares-references"]').text()).toContain('обычный коридор');
    expect(chart.get('[data-test="shares-references"]').text()).toContain('необычный месяц');
    expect(chart.get('[data-test="shares-plot"]').attributes('aria-label')).toContain('2026 — −12% (необычно низко)');
    expect(chart.get('[data-test="shares-tile-usual"]').text()).toContain('22%');
    expect(chart.get('[data-test="shares-tile-trend"]').text()).toContain('хуже');
    expect(chart.get('[data-test="shares-tile-trend"]').text()).toContain('в среднем 11% против 24% до этого');
    // A finished month: the third tile is the month against the user's usual.
    expect(chart.get('[data-test="shares-tile-month"]').text()).toContain('Февраль');
    expect(chart.get('[data-test="shares-tile-month"]').text()).toContain('лучше обычного (24%)');
    w.unmount();
  });

  it('a running month\'s forecast: a tile with its range, a hatched bar named in words, how it is made', async () => {
    answer = {
      ...OVERVIEW,
      period: { ...OVERVIEW.period, incomplete: true },
      budget: { ...OVERVIEW.budget, month: null },
      health: { ...OVERVIEW.health!, forecast: { value: -5, low: -15, high: 5, standing: 'outside' } },
    };
    const w = await mountPage();
    const tile = w.get('[data-test="shares-tile-month"]');
    expect(tile.text()).toContain('около −5%');
    expect(tile.text()).toContain('от −15% до 5%');
    expect(w.get('[data-test="shares-references"]').text()).toContain('прогноз');
    expect(w.get('[data-test="shares-plot"]').attributes('aria-label')).toContain('прогноз ≈ −5%');
    expect(w.get('[data-test="insights-basis"]').text()).toContain('Прогноз: уже потраченное');
    w.unmount();
  });

  it('the checklist with monthly limits: one over is outside the guide', async () => {
    answer = {
      ...OVERVIEW,
      monthlyLimits: 2,
      limitsOver: [{ categoryId: 'cafes', amount: 400_000, spent: 530_000, over: 130_000, severity: 'medium' }],
      standing: { ...OVERVIEW.standing, limits: 'outside' },
    };
    const w = await mountPage();
    const limits = w.get('[data-test="health-limits"]');
    expect(limits.text()).toContain('превышено: 1');
    expect(limits.get('[data-test="health-standing"]').text()).toBe(', вне ориентира');
    w.unmount();
  });

  it('the checklist while the month runs: one row says the shares wait for its end, the reserve keeps its standing', async () => {
    answer = {
      ...OVERVIEW,
      period: { ...OVERVIEW.period, incomplete: true },
      budget: { ...OVERVIEW.budget, month: null },
      standing: { ...OVERVIEW.standing, left: null, essential: null, wants: null, fixed: null, debt: null },
      health: {
        ...OVERVIEW.health!,
        versus: { left: null, essential: null, wants: null, fixed: null, debt: null },
        income: null,
        spending: { kind: 'pace', spent: 45, passed: 33, standing: 'outside' },
      },
    };
    const w = await mountPage();
    const list = w.get('[data-test="health-checklist"]');
    expect(list.get('[data-test="health-spending"]').text()).toContain('45% за 33% месяца');
    // Day 7: the forecast tile says it is too early.
    expect(w.get('[data-test="shares-tile-month"]').text()).toContain('рано судить');
    expect(list.find('[data-test="health-bar"]').exists()).toBe(false);
    // One row for the five shares, not five rows saying the same.
    expect(list.find('[data-test="health-wants"]').exists()).toBe(false);
    expect(list.get('[data-test="health-shares"]').text()).toContain('Доли от дохода');
    expect(list.get('[data-test="health-shares"]').text()).toContain('после конца месяца');
    expect(list.get('[data-test="health-shares"]').find('[data-test="health-standing"]').exists()).toBe(false);
    // The reserve, months in the red, the pace and strong signals: one within the guide.
    expect(list.get('[data-test="health-count"]').text()).toBe('0 из 4');
    w.unmount();
  });

  it('too little history: the checklist without the chart; the reserve says why it is missing', async () => {
    answer = { ...OVERVIEW, months: 2, usual: null, history: [], cards: [], newPayees: [], oneOffs: [], budget: { ...OVERVIEW.budget, reserve: null }, standing: { ...OVERVIEW.standing, reserve: null } };
    const w = await mountPage();
    expect(w.find('[data-test="shares-chart"]').exists()).toBe(false);
    expect(w.get('[data-test="health-reserve"]').text()).toContain('Нужны хотя бы 3 целых месяца истории.');
    w.unmount();
  });

  it('filters: severity with the month\'s counts, then kind; both rows together; pressed state announced', async () => {
    const w = await mountPage();
    const sev = w.get('[data-test="filter-severity"]');
    expect(sev.attributes('role')).toBe('group');
    expect(sev.findAll('button').map((b) => plain(b.text()))).toEqual(['Все 4', 'Высокие 2', 'Средние 1', 'Низкие 1']);
    await w.get('[data-test="filter-severity-high"]').trigger('click');
    expect(w.get('[data-test="filter-severity-high"]').attributes('aria-pressed')).toBe('true');
    expect(w.get('[data-test="filter-severity-all"]').attributes('aria-pressed')).toBe('false');
    expect(w.findAll('article').map((a) => a.attributes('data-test'))).toEqual(['signal-card-high', 'insight-card-high']);
    await w.get('[data-test="filter-kind-oneOffs"]').trigger('click');
    expect(w.findAll('article').map((a) => a.attributes('data-test'))).toEqual(['signal-card-high']);
    // The severity counts stay those of the month.
    expect(plain(w.get('[data-test="filter-severity-high"]').text())).toBe('Высокие 2');
    w.unmount();
  });

  it('a filter with nothing in it says so and resets both rows', async () => {
    const w = await mountPage();
    await w.get('[data-test="filter-severity-medium"]').trigger('click');
    await w.get('[data-test="filter-kind-payees"]').trigger('click');
    expect(w.findAll('article')).toHaveLength(0);
    expect(w.get('[data-test="feed-empty"]').text()).toContain('Под этот фильтр сигналов нет.');
    await w.get('[data-test="feed-reset"]').trigger('click');
    expect(w.findAll('article')).toHaveLength(4);
    expect(w.get('[data-test="filter-kind-all"]').attributes('aria-pressed')).toBe('true');
    w.unmount();
  });

  it('the filter is remembered on this computer; a bad stored value reads as «All»', async () => {
    const first = await mountPage();
    await first.get('[data-test="filter-severity-low"]').trigger('click');
    first.unmount();
    expect(JSON.parse(localStorage.getItem('insights.feedFilter')!)).toEqual({ severity: 'low', kind: 'all' });
    answer = { ...OVERVIEW, month: '2026-01' };
    const again = await mountPage();
    expect(again.get('[data-test="filter-severity-low"]').attributes('aria-pressed')).toBe('true');
    expect(again.findAll('article').map((a) => a.attributes('data-test'))).toEqual(['signal-card-low']);
    again.unmount();
    localStorage.setItem('insights.feedFilter', '{"severity":"huge","kind":7}');
    const bad = await mountPage();
    expect(bad.get('[data-test="filter-severity-all"]').attributes('aria-pressed')).toBe('true');
    expect(bad.get('[data-test="filter-kind-all"]').attributes('aria-pressed')).toBe('true');
    bad.unmount();
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
