// @vitest-environment happy-dom
// The now strip: pure helpers and the feature mounted. Fictional fixtures only.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { defineComponent, h } from 'vue';
import { createMemoryHistory, createRouter } from 'vue-router';
import type { NowOverview, NowOverviewQuery, PeopleView } from '@contract/api.ts';
import { moneyFormat } from '@/entities/currency-display';
import WeekBars from '@/features/now-strip/components/WeekBars.vue';
import { categoryColor } from '@/entities/category';
import { breakdown, categoryChip, daysRange, dayLabel, nowChip, nowView, parsePrefs, weekBars } from '@/features/now-strip/utils.ts';
import { formatMoney } from '@/shared/lib';

const uah = (k: number) => formatMoney(k, 980);

// Saturday 3 October: today 720 ₴ against a usual 520 ₴; the week 3 220 ₴ against 3 600 ₴ on the same days.
const NOW: NowOverview = {
  date: '2026-10-03',
  weekday: 6,
  dataUntil: '2026-10-03',
  today: { net: 72_000, purchases: 3 },
  todayCategories: [
    { category: 'продукты', categoryId: 'groceries', net: 45_000, purchases: 2, rank: 0 },
    { category: 'кафе и рестораны', categoryId: 'cafes', net: 27_000, purchases: 1, rank: 1 },
  ],
  usualDay: 52_000,
  week: {
    from: '2026-09-28',
    days: [40_000, 0, 120_000, 30_000, 60_000, 72_000, null],
    total: { net: 322_000, purchases: 28 },
    prev: 360_000,
    top: { category: 'продукты', categoryId: 'groceries', net: 125_580, purchases: 11, rank: 0 },
    categories: [
      { category: 'продукты', categoryId: 'groceries', net: 125_580, purchases: 11, rank: 0, prev: 106_000 },
      { category: 'кафе и рестораны', categoryId: 'cafes', net: 80_000, purchases: 6, rank: 1, prev: 80_000 },
      { category: 'доставка', categoryId: 'delivery', net: 40_000, purchases: 2, rank: null, prev: 0 },
      { category: 'такси и транспорт', categoryId: 'transport', net: 30_000, purchases: 5, rank: 2, prev: 50_000 },
    ],
    pendingHolds: 0,
  },
  rates: { list: [{ currency: 840, rate: 41 }, { currency: 978, rate: 45 }], fetchedAt: 0, saved: false },
};
const NONE = { uah: false, usd: false, eur: false };
const OFF = moneyFormat(NOW.rates, { main: 980, also: NONE });

let current: NowOverview = NOW;
const getNowOverview = vi.fn(async (_q: NowOverviewQuery) => current);
vi.mock('@/shared/api', () => ({ balanceApi: { getNowOverview: (...a: unknown[]) => getNowOverview(...(a as [NowOverviewQuery])) } }));

describe('now strip helpers', () => {
  it('the day and the week range', () => {
    expect(dayLabel('2026-10-03', 6)).toBe('сб, 3 окт');
    expect(daysRange(6)).toBe('пн–сб');
    expect(daysRange(1)).toBe('пн');
  });

  it('bars: today, past, future; heights relative to the largest day, a small day stays visible', () => {
    expect(weekBars([40_000, 0, 120_000, 1_000, null, null, null], 4)).toEqual([
      { kind: 'past', height: 33 },
      { kind: 'past', height: 0 },
      { kind: 'past', height: 100 },
      { kind: 'today', height: 6 },
      { kind: 'future', height: 0 },
      { kind: 'future', height: 0 },
      { kind: 'future', height: 0 },
    ]);
  });

  it('chips: percent with the sign and the arrow, «as usual» under 3%, none without a base or with a base of 0', () => {
    expect(nowChip(72_000, 52_000, 'usual')).toEqual({ text: '+38%', tone: 'up', arrow: 'up', sr: 'больше, чем в обычный день' });
    expect(nowChip(322_000, 360_000, 'week')).toEqual({ text: '−11%', tone: 'down', arrow: 'down', sr: 'меньше, чем на прошлой неделе' });
    expect(nowChip(52_500, 52_000, 'usual')).toEqual({ text: 'как обычно', tone: 'neutral', arrow: null, sr: '' });
    expect(nowChip(100, null, 'week')).toBeNull();
    expect(nowChip(100, 0, 'usual')).toBeNull();
  });

  it('the category colour of the spending block: top 7 by rank, else «other»', () => {
    expect(categoryColor(0)).toBe('var(--category-1)');
    expect(categoryColor(6)).toBe('var(--category-7)');
    expect(categoryColor(7)).toBe('var(--category-other)');
    expect(categoryColor(null)).toBe('var(--category-other)');
  });

  it('the view: titles, amounts, chips with context, the top category, conversions only when switched on', () => {
    const v = nowView(NOW, OFF);
    expect(v.today).toEqual({
      title: 'Сегодня · сб, 3 окт',
      amount: uah(72_000),
      ops: '3 операции',
      conv: '',
      chip: { text: '+38%', tone: 'up', arrow: 'up', sr: 'больше, чем в обычный день' },
      context: `к обычному дню ≈ ${uah(52_000)}`,
      until: '',
    });
    expect(v.week).toMatchObject({ title: 'Эта неделя · пн–сб', amount: uah(322_000), context: 'к прошлой неделе, пн–сб', pending: 0 });
    expect(v.top).toEqual({ name: 'Продукты', color: 'var(--category-1)', amount: uah(125_580), caption: '39% недели · 11 оп.' });
    expect(nowView(NOW, moneyFormat(NOW.rates, { main: 980, also: { uah: true, usd: true, eur: true } })).today.conv).toBe(`≈ ${formatMoney(Math.round(72_000 / 41), 840)} · ${formatMoney(1_600, 978)}`);
  });

  it('euro main: every amount in euros (the top category too), «≈» in the other picked currencies', () => {
    const fmt = moneyFormat(NOW.rates, { main: 978, also: { uah: true, usd: false, eur: true } });
    const v = nowView(NOW, fmt);
    expect(v.today.amount).toBe(fmt.money(72_000));
    expect(v.today.amount).toBe(formatMoney(1_600, 978));
    expect(v.today.conv).toBe(fmt.approxInline(72_000));
    expect(v.today.conv).toBe(`≈ ${uah(72_000)}`);
    expect(v.today.context).toBe(`к обычному дню ≈ ${fmt.money(52_000)}`);
    expect(v.week).toMatchObject({ amount: fmt.money(322_000), conv: fmt.approxInline(322_000) });
    expect(v.top?.amount).toBe(fmt.money(125_580));
  });

  it('stale data: «data until» instead of the chip; no usual day or last week: no chip, no context; an empty week: no top', () => {
    expect(nowView({ ...NOW, dataUntil: '2026-10-02' }, OFF).today).toMatchObject({ chip: null, context: '', until: 'Данные до 02.10' });
    const bare = nowView({ ...NOW, usualDay: 0, week: { ...NOW.week, prev: null, top: null } }, OFF);
    expect(bare.today).toMatchObject({ chip: null, context: '' });
    expect(bare.week).toMatchObject({ chip: null, context: '' });
    expect(bare.top).toBeNull();
  });

  it('the top category\'s share stays within 100% when refunds in other categories pull the week below it', () => {
    const v = nowView({ ...NOW, week: { ...NOW.week, total: { net: 100_000, purchases: 12 } } }, OFF);
    expect(v.top?.caption).toBe('100% недели · 11 оп.');
  });
});

describe('now strip categories', () => {
  it('a category chip against the same days last week: percent, «same», «new»; none without a comparison', () => {
    expect(categoryChip(125_580, 106_000)).toEqual({ text: '+18%', tone: 'up', arrow: 'up', sr: 'больше, чем на прошлой неделе' });
    expect(categoryChip(30_000, 50_000)).toMatchObject({ text: '−40%', tone: 'down' });
    expect(categoryChip(80_000, 80_000)).toEqual({ text: 'так же', tone: 'neutral', arrow: null, sr: '' });
    expect(categoryChip(40_000, 0)).toEqual({ text: 'новое', tone: 'neutral', arrow: null, sr: '' });
    expect(categoryChip(40_000, null)).toBeNull();
  });

  it('the week: every category with its colour, share, amount, operations, chip; the summary and the note', () => {
    const w = nowView(NOW, OFF).categories.week;
    expect(w.rows.map((r) => [r.name, r.color, r.share, r.amount, r.ops, r.chip?.text ?? null])).toEqual([
      ['Продукты', 'var(--category-1)', 39, uah(125_580), '11 оп.', '+18%'],
      ['Кафе и рестораны', 'var(--category-2)', 25, uah(80_000), '6 оп.', 'так же'],
      ['Доставка', 'var(--category-other)', 12, uah(40_000), '2 оп.', 'новое'],
      ['Такси и транспорт', 'var(--category-3)', 9, uah(30_000), '5 оп.', '−40%'],
    ]);
    expect(w.summary).toBe(`4 категории · ${uah(322_000)} · 28 операций`);
    expect(w.note).toBe('Сравнение с теми же днями прошлой недели, пн–сб');
  });

  it('each row opens its category\'s screen for that day or week, personal spending; an unknown category — no link', () => {
    const v = nowView(NOW, OFF);
    expect(v.categories.week.rows[0]?.to).toEqual({ name: 'category', params: { id: 'groceries' }, query: { scope: 'personal', week: '2026-09-28' } });
    expect(v.categories.today.rows[1]?.to).toEqual({ name: 'category', params: { id: 'cafes' }, query: { scope: 'personal', day: '2026-10-03' } });
    const unknown = breakdown([{ category: 'новая', categoryId: null, net: 1_000, purchases: 1, rank: null }], { net: 1_000, purchases: 1 }, { kind: 'day', date: '2026-10-03' }, OFF);
    expect(unknown.rows[0]?.to).toBeNull();
  });

  it('today: no chips, no note; without last week the week has neither', () => {
    const v = nowView(NOW, OFF);
    expect(v.categories.today.rows.map((r) => [r.name, r.share, r.chip])).toEqual([
      ['Продукты', 63, null],
      ['Кафе и рестораны', 38, null],
    ]);
    expect(v.categories.today).toMatchObject({ summary: `2 категории · ${uah(72_000)} · 3 операции`, note: '' });
    const bare = nowView({ ...NOW, week: { ...NOW.week, prev: null, categories: NOW.week.categories.map((c) => ({ ...c, prev: null })) } }, OFF);
    expect(bare.categories.week.note).toBe('');
    expect(bare.categories.week.rows.every((r) => r.chip === null)).toBe(true);
  });

  it('an empty period: no rows, no summary; a share stops at 100%', () => {
    expect(breakdown([], { net: 0, purchases: 0 }, { kind: 'day', date: '2026-10-03' }, OFF)).toEqual({ rows: [], summary: '', note: '' });
    const over = breakdown([{ category: 'продукты', categoryId: 'groceries', net: 10_000, purchases: 1, rank: 0 }], { net: 8_000, purchases: 2 }, { kind: 'day', date: '2026-10-03' }, OFF);
    expect(over.rows[0]?.share).toBe(100);
  });

  it('stored choices: each field forgiven on its own, closed on the week by default', () => {
    expect(parsePrefs(null)).toEqual({ open: false, period: 'week' });
    expect(parsePrefs('{')).toEqual({ open: false, period: 'week' });
    expect(parsePrefs('{"open":true,"period":"month"}')).toEqual({ open: true, period: 'week' });
    expect(parsePrefs('{"open":"yes","period":"today"}')).toEqual({ open: false, period: 'today' });
  });
});

const PEOPLE: PeopleView = {
  people: [
    { id: 1, label: 'Сергей', labelFromBank: false, labelPending: false, color: 'blue', connections: [] },
    { id: 2, label: 'Аня', labelFromBank: false, labelPending: false, color: 'orange', connections: [] },
  ],
  secureStorage: true,
};

describe('now strip mounted', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    getNowOverview.mockClear();
    current = NOW;
    localStorage.clear();
  });

  async function mountStrip() {
    const { i18n } = await import('@/shared/lib/i18n.ts');
    const { useParticipantStore } = await import('@/entities/participant');
    useParticipantStore().view = PEOPLE;
    const { NowStripFeature } = await import('@/features/now-strip');
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', name: 'home', component: defineComponent(() => () => h('div')) },
        { path: '/category/:id', name: 'category', component: defineComponent(() => () => h('div')) },
      ],
    });
    await router.push('/');
    const w = mount(NowStripFeature, { global: { plugins: [i18n, router] } });
    await flushPromises();
    return w;
  }

  it('three cells for the whole family, the bars hidden from screen readers', async () => {
    const w = await mountStrip();
    expect(getNowOverview.mock.calls[0]?.[0]).toEqual({});
    expect(w.find('section').attributes('aria-label')).toBe('Сейчас');
    for (const s of ['Сегодня · сб, 3 окт', uah(72_000), '+38%', 'Эта неделя · пн–сб', 'к прошлой неделе, пн–сб', 'Больше всего за неделю', 'Продукты', '39% недели · 11 оп.']) {
      expect(w.text()).toContain(s);
    }
    expect(w.find('.v-change-chip__sr').text()).toBe('больше, чем в обычный день');
    const bars = w.findComponent(WeekBars);
    expect(bars.attributes('aria-hidden')).toBe('true');
    expect(bars.findAll('span')).toHaveLength(7);
  });

  it('follows the global people filter', async () => {
    const w = await mountStrip();
    const { useParticipantStore } = await import('@/entities/participant');
    useParticipantStore().select(2);
    await flushPromises();
    expect(getNowOverview.mock.calls.at(-1)?.[0]).toEqual({ participantId: 2 });
    w.unmount();
  });

  it('hidden while a past month is picked; back for the current month', async () => {
    const w = await mountStrip();
    const { useMonthStore } = await import('@/entities/period');
    const months = useMonthStore();
    const thisMonth = months.thisMonth;
    months.set('2020-01', null);
    await flushPromises();
    expect(w.find('section').exists()).toBe(false);
    months.set(thisMonth, null);
    await flushPromises();
    expect(w.find('section').exists()).toBe(true);
  });

  it('reloads quietly on new data; currencies follow the shared choice; pending holds and an empty week', async () => {
    const w = await mountStrip();
    const { useCurrencyDisplayStore } = await import('@/entities/currency-display');
    useCurrencyDisplayStore().setAlso('usd', true);
    await flushPromises();
    expect(w.text()).toContain(`≈ ${formatMoney(Math.round(72_000 / 41), 840)}`);

    current = { ...NOW, week: { ...NOW.week, pendingHolds: 2, top: null } };
    const { useSyncStatusStore } = await import('@/entities/sync-status');
    useSyncStatusStore().version++;
    await flushPromises();
    expect(getNowOverview).toHaveBeenCalledTimes(2);
    expect(w.text()).toContain('В обработке банком: 2');
    expect(w.text()).toContain('На этой неделе трат ещё нет');
  });

  it('the category panel: closed at first; opens on the week, switches to today, remembers both', async () => {
    const w = await mountStrip();
    const toggle = w.get('[data-test="now-categories-toggle"]');
    expect(toggle.text()).toBe('По категориям');
    expect(toggle.attributes('aria-expanded')).toBe('false');
    expect(w.find('[role="region"]').exists()).toBe(false);

    await toggle.trigger('click');
    expect(toggle.attributes('aria-expanded')).toBe('true');
    const panel = w.get('[role="region"]');
    expect(panel.attributes('aria-label')).toBe('Траты по категориям');
    expect(panel.findAll('li')).toHaveLength(4);
    expect(panel.text()).toContain('Доставка');
    expect(panel.text()).toContain('4 категории');
    expect(panel.text()).toContain('Сравнение с теми же днями прошлой недели, пн–сб');
    expect(panel.find('a').attributes('href')).toBe('/category/groceries?scope=personal&week=2026-09-28');

    const today = panel.findAll('button').find((b) => b.text() === 'Сегодня');
    await today?.trigger('click');
    expect(w.get('[role="region"]').findAll('li')).toHaveLength(2);
    expect(w.get('[role="region"]').text()).not.toContain('Сравнение');
    expect(JSON.parse(localStorage.getItem('now.categories') ?? 'null')).toEqual({ open: true, period: 'today' });
  });

  it('the category panel opens as left; an empty day says so', async () => {
    localStorage.setItem('now.categories', JSON.stringify({ open: true, period: 'today' }));
    current = { ...NOW, todayCategories: [], today: { net: 0, purchases: 0 } };
    const w = await mountStrip();
    expect(w.get('[data-test="now-categories-toggle"]').attributes('aria-expanded')).toBe('true');
    expect(w.get('[role="region"]').text()).toContain('Сегодня трат ещё нет');
  });
});
