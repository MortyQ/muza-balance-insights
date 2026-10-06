// @vitest-environment happy-dom
// The category screen (features/category-detail): its pure helpers, the link from «Spending», the screen mounted.
// Fictional fixtures only. Typechecked with the renderer (tsconfig.web.json).
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { defineComponent, h } from 'vue';
import { createMemoryHistory, createRouter } from 'vue-router';
import type { CategoryLineView, CategoryOverview, CategoryOverviewQuery, PeopleView } from '@contract/api.ts';
import { moneyFormat } from '@/entities/currency-display';
import { monthsChartOption, SOFT_BAR } from '@/entities/operations';
import { lineRows, listTotal, merchantsView, monthsView, noneText, peopleView, summaryView, whenView } from '@/features/category-detail/utils.ts';
import { categoryLink, categoryRequest } from '@/shared/config';
import { formatMoney } from '@/shared/lib';

const uah = (k: number) => formatMoney(k, 980);
const NONE = { uah: false, usd: false, eur: false };
const RATES = { list: [{ currency: 840, rate: 40 }, { currency: 978, rate: 45 }], fetchedAt: 0, saved: false };
const FMT = moneyFormat(RATES, { main: 980, also: NONE });

const line = (o: Partial<CategoryLineView>): CategoryLineView => ({
  key: 'k', date: '2026-09-05', time: '23:30', weekday: 6, merchant: 'Vigadane Taxi', comment: null, participantId: 1,
  account: { kind: 'card', type: 'black', currency: 980, tag: null }, uah: -20_000, currency: 980, amount: -20_000, operation: null,
  commission: false, hold: false, pending: false, refund: false, refunded: false, cashback: 0, ...o,
});

const LINES: CategoryLineView[] = [
  line({ key: 'a', date: '2026-09-19', time: '03:10', weekday: 6, uah: -64_000, amount: -64_000, comment: 'Вигаданий аеропорт', cashback: 600 }),
  line({ key: 'b', date: '2026-09-17', time: '20:21', weekday: 4, uah: 23_000, amount: 23_000, refund: true }),
  line({ key: 'c', date: '2026-09-17', time: '20:05', weekday: 4, uah: -23_000, amount: -23_000, refunded: true }),
  line({ key: 'd', date: '2026-09-10', time: '10:45', weekday: 4, merchant: 'IMAGINARY  bus', uah: -59_800, amount: -1_495, currency: 840, operation: { currency: 978, amount: -1_240 }, participantId: 2 }),
  line({ key: 'e', date: '2026-09-02', time: '08:15', weekday: 3, merchant: 'Imaginary Bus', uah: -17_200, amount: -17_200, pending: true, hold: true }),
];

const VIEW: CategoryOverview = {
  month: '2026-09',
  category: 'такси и транспорт',
  categoryId: 'transport',
  period: { from: '2026-09-01', to: '2026-09-30', days: 30, incomplete: false, dataUntil: '2026-10-05', coveredDays: 30, pendingHolds: 1 },
  compare: { from: '2026-08-01', to: '2026-08-31', partial: false },
  summary: {
    net: 141_000, purchases: 4, gross: 164_000, refunds: 23_000, prev: { net: 100_000, purchases: 3 }, median: 41_400, perDay: 4_700,
    activeDays: 4, largest: 'a', cashback: 600, cashbackLines: 1, share: 0.078, rank: 4,
  },
  months: [
    ...Array.from({ length: 9 }, (_, i) => ({ month: `2025-${String(10 + i > 12 ? i - 2 : 10 + i).padStart(2, '0')}`, net: null })),
    { month: '2026-07', net: 80_000 },
    { month: '2026-08', net: 100_000 },
    { month: '2026-09', net: 141_000 },
  ],
  thisMonth: '2026-09',
  people: [{ participantId: 1, net: 81_200, purchases: 3 }, { participantId: 2, net: 59_800, purchases: 1 }],
  merchants: [{ name: 'Vigadane Taxi', net: 64_000, purchases: 2 }, { name: 'IMAGINARY  bus', net: 77_000, purchases: 2 }],
  lines: LINES,
  rates: RATES,
  leftOut: [],
};

const PEOPLE = [{ id: 1, name: 'Сергей', color: 'var(--series-blue)' }, { id: 2, name: 'Аня', color: 'var(--series-orange)' }];

describe('category screen helpers', () => {
  it('summary: name, colour by rank, the change against last month, the figures', () => {
    const s = summaryView(VIEW, 'Вся семья', 'Личное', FMT);
    expect(s).toMatchObject({ name: 'Такси и транспорт', icon: 'lucide:bus', color: 'var(--category-4)', subtitle: 'Сентябрь 2026 · Вся семья · Личное', amount: uah(141_000) });
    expect(s.chip).toMatchObject({ tone: 'up', arrow: 'up', text: 'на 41% больше, чем в августе' });
    expect(s.prev).toBe(`в августе было ${uah(100_000)}`);
    expect(s.note).toBe(`Списано ${uah(164_000)} · возвраты −${uah(23_000)}`);
    expect(s.stats.map((x) => [x.label, x.value])).toEqual([
      ['Операций', '4'],
      ['Средний чек', uah(41_000)],
      ['В день', uah(4_700)],
      ['Доля всех трат', '8%'],
      ['Самая крупная', uah(64_000)],
      ['Кэшбэк', `+${uah(600)}`],
    ]);
    expect(s.stats[4]!.note).toBe('Vigadane Taxi, 19 сен в 03:10');
    expect(s.stats[3]!.note).toBe('4-е место за месяц');
  });

  it('12 months: bars on one scale, months before the data flat, the average of the known ones', () => {
    const m = monthsView(VIEW, FMT);
    expect(m.bars).toHaveLength(12);
    expect(m.bars.slice(-3).map((b) => [b.height, b.strong])).toEqual([[56.7, false], [70.9, false], [100, true]]);
    expect(m.bars[0]!.height).toBe(0);
    expect(m.avg).toBe(63.8); // the running September is not in it: (800 + 1 000) / 2 = 900 of 1 410
    expect(m.caption).toBe(`в среднем ${uah(90_000)} в месяц · Сентябрь: на ${uah(51_000)} больше среднего`);
    expect(m.bars.at(-1)!.title).toBe(`Сентябрь 2026 — ${uah(141_000)} на сегодня`);
  });

  it('12 months as an ECharts option: the bars\' heights and colours, the dashed average, the strong label, the tooltip', () => {
    const m = monthsView(VIEW, FMT);
    const o = monthsChartOption(m) as {
      xAxis: { data: string[]; axisLabel: { formatter: (l: string, i: number) => string } };
      tooltip: { renderMode: string; formatter: (p: { dataIndex: number }) => string };
      series: Array<{ data: Array<{ value: number; itemStyle: { color: string } }>; markLine: { data: Array<{ yAxis: number }> } }>;
    };
    expect(o.xAxis.data).toEqual(m.bars.map((b) => b.label));
    const bars = o.series[0]!.data;
    expect(bars.slice(-3).map((b) => [b.value, b.itemStyle.color])).toEqual([[56.7, SOFT_BAR], [70.9, SOFT_BAR], [100, 'var(--cat)']]);
    expect(o.series[0]!.markLine.data).toEqual([{ yAxis: 63.8 }]);
    expect(o.xAxis.axisLabel.formatter('сен', 11)).toBe('{strong|сен}');
    expect(o.xAxis.axisLabel.formatter('авг', 10)).toBe('авг');
    expect(o.tooltip.renderMode).toBe('richText');
    expect(o.tooltip.formatter({ dataIndex: 11 })).toBe(m.bars[11]!.title);
    expect(monthsChartOption({ ...m, avg: null }).series).toEqual([expect.not.objectContaining({ markLine: expect.anything() })]);
  });

  it('12 months up to today: the picked month is the strong bar and the caption compares it', () => {
    const v = { ...VIEW, month: '2026-08', thisMonth: '2026-09' };
    const m = monthsView(v, FMT);
    expect(m.bars.slice(-3).map((b) => b.strong)).toEqual([false, true, false]);
    expect(m.caption).toBe(`в среднем ${uah(90_000)} в месяц · Август: на ${uah(10_000)} больше среднего`);
    expect(m.bars.at(-2)!.title).toBe(`Август 2026 — ${uah(100_000)}`);
  });

  it('who, where, when', () => {
    expect(peopleView(VIEW, PEOPLE, FMT).map((p) => [p.name, p.width, p.caption])).toEqual([
      ['Сергей', 100, `3 оп. · ср. ${uah(27_067)}`],
      ['Аня', 73.6, `1 оп. · ср. ${uah(59_800)}`],
    ]);
    const where = merchantsView(VIEW, 'imaginary bus', FMT);
    expect(where.map((m) => [m.key, m.width, m.pressed])).toEqual([['vigadane taxi', 83.1, false], ['imaginary bus', 100, true]]);
    // a refund and its purchase on the same Thursday evening cancel out
    const when = whenView(LINES, VIEW, '', FMT);
    expect(when.title).toBe('Когда');
    expect(when.peak).toBe('Больше всего: сб · утро 6–12');
    expect(when.weekdays.map((b) => b.height)).toEqual([0, 0, 26.9, 93.4, 0, 100, 0]);
    expect(when.dayParts.map((p) => p.width)).toEqual([100, 0, 0, 83.1]);
    expect(when.days.filter((d) => d.strong).map((d) => d.label)).toEqual(['2', '10', '19']);
  });

  it('«When» of one merchant: only its lines, its name in the title', () => {
    const bus = whenView(LINES.filter((l) => l.key === 'd' || l.key === 'e'), VIEW, 'IMAGINARY  bus', FMT);
    expect(bus.title).toBe('Когда: IMAGINARY  bus');
    expect(bus.weekdays.map((b) => b.height)).toEqual([0, 0, 28.8, 100, 0, 0, 0]);
    expect(bus.dayParts.map((p) => p.width)).toEqual([100, 0, 0, 0]);
    expect(bus.peak).toBe('Больше всего: чт · утро 6–12');
  });

  it('the list: marks, signs, the original currency; a merchant filter case-insensitively, a search by digits, by amount', () => {
    const all = lineRows(LINES, { merchant: null, query: '', sort: 'date' }, PEOPLE, FMT).rows;
    expect(all.map((r) => [r.key, r.amount, r.marks.map((m) => m.text)])).toEqual([
      ['a', `−${uah(64_000)}`, [`кэшбэк +${uah(600)}`]],
      ['b', `+${uah(23_000)}`, ['возврат']],
      ['c', `−${uah(23_000)}`, ['возвращена']],
      ['d', `−${uah(59_800)}`, ['в валюте']],
      ['e', `−${uah(17_200)}`, ['в обработке']],
    ]);
    expect(all[0]).toMatchObject({ date: '19 сен', time: 'сб, 03:10', comment: 'Вигаданий аеропорт', person: 'Сергей' });
    expect(all[3]).toMatchObject({ original: formatMoney(1_240, 978), person: 'Аня' });

    const bus = lineRows(LINES, { merchant: 'imaginary bus', query: '', sort: 'amount' }, PEOPLE, FMT);
    expect(bus.rows.map((r) => r.key)).toEqual(['d', 'e']);
    expect(listTotal(VIEW, bus.shown, true, FMT)).toBe(uah(77_000));
    expect(listTotal(VIEW, LINES, false, FMT)).toBe(uah(141_000));
    expect(lineRows(LINES, { merchant: null, query: 'аэро', sort: 'date' }, PEOPLE, FMT).rows).toHaveLength(0);
    expect(lineRows(LINES, { merchant: null, query: 'аеро', sort: 'date' }, PEOPLE, FMT).rows.map((r) => r.key)).toEqual(['a']);
    expect(lineRows(LINES, { merchant: null, query: '640', sort: 'date' }, PEOPLE, FMT).rows.map((r) => r.key)).toEqual(['a']);
  });

  it('a month without lines says so', () => {
    expect(noneText({ ...VIEW, lines: [] })).toBe('В сентябре трат в этой категории нет.');
    expect(noneText(VIEW)).toBe('');
  });
});

describe('the category route', () => {
  it('a link from «Spending» carries the category and the scope; the page reads them back', () => {
    const link = categoryLink('transport', 'business');
    expect(link).toEqual({ name: 'category', params: { id: 'transport' }, query: { scope: 'business' } });
    expect(categoryRequest(link.params, link.query)).toEqual({ id: 'transport', scope: 'business' });
    expect(categoryRequest({ id: 'такси' }, { scope: 'all' })).toEqual({ id: null, scope: 'personal' });
  });
});

let current: CategoryOverview = VIEW;
const getCategoryOverview = vi.fn(async (_q: CategoryOverviewQuery) => current);
vi.mock('@/shared/api', () => ({ balanceApi: { getCategoryOverview: (...a: unknown[]) => getCategoryOverview(...(a as [CategoryOverviewQuery])) } }));

const PEOPLE_VIEW: PeopleView = {
  people: [
    { id: 1, label: 'Сергей', labelFromBank: false, labelPending: false, color: 'blue', connections: [] },
    { id: 2, label: 'Аня', labelFromBank: false, labelPending: false, color: 'orange', connections: [] },
  ],
  secureStorage: true,
};

describe('category screen mounted', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    getCategoryOverview.mockClear();
    current = VIEW;
    localStorage.clear();
  });

  async function mountScreen() {
    const { i18n } = await import('@/shared/lib/i18n.ts');
    const { useParticipantStore } = await import('@/entities/participant');
    useParticipantStore().view = PEOPLE_VIEW;
    const { useMonthStore } = await import('@/entities/period');
    useMonthStore().set('2026-09', null);
    const { CategoryDetailFeature } = await import('@/features/category-detail');
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/', name: 'home', component: defineComponent(() => () => h('div')) }],
    });
    await router.push('/');
    const w = mount(CategoryDetailFeature, { props: { categoryId: 'transport', scope: 'personal' }, global: { plugins: [i18n, router] } });
    await flushPromises();
    return w;
  }

  it('asks for the month, the category and the scope; shows every block; a merchant filters the list and a chip clears it', async () => {
    const w = await mountScreen();
    expect(getCategoryOverview.mock.calls[0]?.[0]).toEqual({ month: '2026-09', category: 'transport', scope: 'personal' });
    for (const s of ['Траты', 'Такси и транспорт', 'Динамика за 12 месяцев', 'Кто тратил', 'Где', 'Когда', 'Операции', 'Вигаданий аеропорт']) expect(w.text()).toContain(s);
    expect(w.findAll('[role="row"]')).toHaveLength(LINES.length + 1);
    expect(w.findAll('.v-chart').length).toBeGreaterThan(0);

    const bus = w.findAll('button[aria-pressed]').find((b) => b.text().includes('IMAGINARY'))!;
    await bus.trigger('click');
    expect(bus.attributes('aria-pressed')).toBe('true');
    expect(w.text()).toContain('Когда: IMAGINARY  bus');
    expect(w.findAll('[role="row"]')).toHaveLength(3);
    expect(w.text()).toContain(`Итого по списку: ${uah(77_000)}`);

    await w.find('button[aria-label^="Снять фильтр"]').trigger('click');
    expect(w.findAll('[role="row"]')).toHaveLength(LINES.length + 1);
    expect(w.text()).toContain(`Итого по списку: ${uah(141_000)}`);
  });

  it('the first load shows a skeleton in place of the cards; the answer replaces it', async () => {
    let answer!: (v: CategoryOverview) => void;
    getCategoryOverview.mockImplementationOnce(() => new Promise<CategoryOverview>((r) => (answer = r)));
    const w = await mountScreen();
    expect(w.find('[role="status"]').exists()).toBe(true);
    expect(w.text()).not.toContain('Динамика за 12 месяцев');
    answer(VIEW);
    await flushPromises();
    expect(w.find('[role="status"]').exists()).toBe(false);
    expect(w.text()).toContain('Динамика за 12 месяцев');
  });

  it('follows the global person filter; one person — no «Who spent»', async () => {
    const w = await mountScreen();
    const { useParticipantStore } = await import('@/entities/participant');
    useParticipantStore().select(2);
    await flushPromises();
    expect(getCategoryOverview.mock.calls.at(-1)?.[0]).toMatchObject({ participantId: 2 });
    expect(w.text()).not.toContain('Кто тратил');
  });
});
