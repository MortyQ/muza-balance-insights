// @vitest-environment happy-dom
// The analytics screen (features/analytics-overview): pure view builders, chart options, then the screen mounted.
// Fictional fixtures only. Typechecked with the renderer (tsconfig.web.json).
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import type { AnalyticsCategory, AnalyticsOverview, AnalyticsQuery } from '@contract/api.ts';
import type { CategoryId } from '@contract/categories.ts';
import { moneyFormat } from '@/entities/currency-display';
import {
  categoryRows, changesView, columns, comparedText, compareRows, flowChartOption, gapPolygons, heatRows, kpiView, linesOption, miniCards, miniOption, weekGroups,
} from '@/features/analytics-overview/utils.ts';

const FMT = moneyFormat(null, { main: 980, also: { uah: false, usd: false, eur: false } });
const MONTHS = ['2025-10', '2025-11', '2025-12', '2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09'];
/** Thousands of hryvnias → kopecks. */
const k = (x: number) => x * 100_000;
const cat = (id: CategoryId, net: number[], prev: number): AnalyticsCategory => ({
  category: id, categoryId: id, net: net.map(k), total: k(net.reduce((s, x) => s + x, 0)), prev: k(prev),
});

const RANGE: AnalyticsOverview = {
  from: '2025-10', to: '2026-09', unit: 'month',
  buckets: MONTHS.map((key) => ({ key, state: 'full' as const })),
  income: [82, 84, 118, 80, 82, 85, 86, 88, 90, 92, 90, 95].map(k),
  spending: [64, 70, 104, 61, 64, 70, 69, 75, 93, 89, 75, 71].map(k),
  totals: { income: k(1072), spending: k(905), prev: { income: k(980), spending: k(823) } },
  compare: { from: '2024-10-01', to: '2025-09-30', partial: false },
  usual: null,
  categories: [
    cat('groceries', [16, 17, 22, 16, 16, 17, 17, 18, 18, 18, 18, 18], 188),
    cat('cafes', [8, 9, 13, 7, 8, 9, 10, 11, 12, 13, 11, 10], 96),
    cat('home', [6, 9, 14, 4, 5, 7, 5, 8, 4, 5, 6, 7], 92),
    cat('marketplaces', [5, 6, 12, 4, 5, 5, 6, 6, 5, 6, 7, 6], 58),
    cat('transport', [5, 5, 6, 5, 5, 5, 6, 6, 6, 7, 6, 6], 71),
    cat('utilities', [6, 6, 7, 8, 8, 7, 6, 4, 3, 3, 3, 4], 70),
    cat('travel', [0, 0, 8, 0, 0, 2, 0, 3, 26, 18, 4, 0], 34),
    cat('health', [4, 3, 4, 6, 5, 4, 4, 3, 3, 3, 4, 5], 60),
    cat('pets', [4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4], 48),
  ],
  rates: null,
  leftOut: [],
};

const SEPTEMBER = Array.from({ length: 30 }, (_, i) => `2026-09-${String(i + 1).padStart(2, '0')}`);
const MONTH_VIEW: AnalyticsOverview = {
  ...RANGE,
  from: '2026-09', to: '2026-09', unit: 'day',
  buckets: SEPTEMBER.map((key, i) => ({ key, state: i < 20 ? ('full' as const) : i === 20 ? ('running' as const) : ('none' as const) })),
  income: SEPTEMBER.map((_, i) => (i === 4 ? k(90) : 0)),
  spending: SEPTEMBER.map(() => k(1)),
  totals: { income: k(90), spending: k(21), prev: { income: k(88), spending: k(70) } },
  compare: { from: '2026-08-01', to: '2026-08-21', partial: true },
  usual: SEPTEMBER.map((_, i) => k(i + 1) * 0.9),
  categories: [cat('groceries', SEPTEMBER.map((_, i) => (i < 21 ? 1 : 0)), 15)],
};

describe('analytics view builders', () => {
  it('rows: the top 7 by name and rank colour, the rest summed as «Other N»', () => {
    const rows = categoryRows(RANGE.categories, 12);
    expect(rows).toHaveLength(8);
    expect(rows[0]).toMatchObject({ key: 'groceries', name: 'Продукты', color: 'var(--category-1)' });
    expect(rows[6]).toMatchObject({ key: 'travel', color: 'var(--category-7)' });
    expect(rows[7]).toMatchObject({ key: 'other', name: 'Другие 2', color: 'var(--category-other)', prev: k(108) });
    expect(rows[7]!.net[0]).toBe(k(8));
    const all = categoryRows(RANGE.categories, 12, Infinity);
    expect(all).toHaveLength(9);
    expect(all.some((r) => r.key === 'other')).toBe(false);
    expect(all[8]).toMatchObject({ color: 'var(--category-other)' });
  });

  it('weeks of a month: Monday to Sunday, clipped to the month', () => {
    expect(weekGroups(SEPTEMBER).map((w) => [w.label, w.idx.length])).toEqual([['1–6', 6], ['7–13', 7], ['14–20', 7], ['21–27', 7], ['28–30', 3]]);
  });

  it('columns: months of a range; weeks of a month, a week with today or later days runs', () => {
    expect(columns(RANGE).map((c) => c.label).slice(0, 4)).toEqual(['окт ’25', 'ноя', 'дек', 'янв ’26']);
    expect(columns(MONTH_VIEW).map((c) => [c.label, c.days, c.state])).toEqual([
      ['1–6', 6, 'full'], ['7–13', 7, 'full'], ['14–20', 7, 'full'], ['21–27', 1, 'running'], ['28–30', 0, 'none'],
    ]);
  });

  it('heatmap: colour by the per-day level against the row mean; the running column outlined and out of the mean', () => {
    const view = { ...RANGE, buckets: RANGE.buckets.map((b, i) => (i === 11 ? { ...b, state: 'running' as const } : b)) };
    const rows = heatRows(categoryRows(view.categories, 12), columns(view), FMT);
    const travel = rows.find((r) => r.key === 'travel')!;
    expect(travel.cells[8]).toMatchObject({ text: '26', strong: true });
    expect(travel.cells[8]!.background).toContain('var(--heat-hot)');
    expect(travel.cells[0]).toMatchObject({ text: '—' });
    expect(travel.cells[0]!.background).toContain('var(--heat-cold)');
    expect(travel.cells[11]!.running).toBe(true);
    expect(rows[0]!.cells[4]!.background).toBe('var(--surface-sunken)'); // groceries in February: its usual level
    expect(rows.find((r) => r.key === 'utilities')!.cells[9]!.text).toBe('3');
  });

  it('KPIs: income, spending, left and the savings rate with the changes', () => {
    const v = kpiView(RANGE, FMT);
    expect(v.map((x) => x.key)).toEqual(['income', 'spending', 'left', 'rate']);
    expect(v[0]).toMatchObject({ value: FMT.money(k(1072)), note: '+9% к прошлому периоду', tone: 'good' });
    expect(v[1]).toMatchObject({ note: '+10% к прошлому периоду', tone: 'bad' });
    expect(v[2]!.value).toBe(FMT.money(k(167)));
    expect(v[3]).toMatchObject({ value: '15,6%', note: 'было 16,0%', tone: 'bad' });
    expect(kpiView(MONTH_VIEW, FMT)[2]!.note).toContain('в день');
  });

  it('what changed: the 4 largest increases, then the largest decrease; where the peak was', () => {
    const v = changesView(RANGE, FMT);
    expect(v.map((r) => r.key)).toEqual(['travel', 'cafes', 'groceries', 'marketplaces', 'home']);
    expect(v[0]).toMatchObject({ up: true, pct: '+79%', why: 'пик — июнь', delta: `+${FMT.money(k(27))}` });
    expect(v[4]).toMatchObject({ up: false, pct: '−13%' });
    expect(changesView({ ...RANGE, compare: null }, FMT)).toEqual([]);
    expect(changesView(MONTH_VIEW, FMT)[0]!.why).toBe('пик — 1 сен');
  });

  it('the comparison period in words', () => {
    expect(comparedText(RANGE.compare!)).toBe('окт 2024 – сен 2025');
    expect(comparedText(MONTH_VIEW.compare!)).toBe('август 2026');
  });

  it('compare: every category, sorted by the change, bars from the centre', () => {
    const v = compareRows(RANGE, FMT);
    expect(v).toHaveLength(9);
    expect(v[0]!.key).toBe('travel');
    expect(v[0]).toMatchObject({ left: 50, width: 50, up: true });
    const last = v.at(-1)!;
    expect(last.key).toBe('health');
    expect(last.left + last.width).toBe(50);
    expect(last.span).toBe(`${FMT.money(k(60))} → ${FMT.money(k(48))}`);
  });

  it('small chart cards: total, average per month, the change', () => {
    const cards = miniCards(RANGE, categoryRows(RANGE.categories, 12), FMT);
    expect(cards[0]).toMatchObject({ key: 'groceries', total: FMT.money(k(211)), chip: '+12%', up: true });
    expect(cards[0]!.avg).toContain('в месяц');
  });

  it('gap polygons: one quad without a crossing; a crossing splits the area exactly', () => {
    expect(gapPolygons([10, 20], [5, 5])).toEqual([{ positive: true, points: [[0, 10], [1, 20], [1, 5], [0, 5]] }]);
    expect(gapPolygons([10, 10], [5, 15])).toEqual([
      { positive: true, points: [[0, 10], [0.5, 10], [0, 5]] },
      { positive: false, points: [[0.5, 10], [1, 10], [1, 15]] },
    ]);
    expect(gapPolygons([10, null, 10], [5, 5, 5])).toEqual([]);
  });
});

type Series = { id?: string; type: string; data: Array<[number, number | null]> | unknown[]; lineStyle?: { type?: string; opacity?: number }; markLine?: { data: Array<{ yAxis: number }> } };
type Option = { xAxis: { type: string; axisLabel: { formatter: (x: number) => string } }; series: Series[] };

describe('analytics chart options', () => {
  it('flow (a range): two fills, then income and spending on a value axis by index, months as labels', () => {
    const o = flowChartOption(RANGE, FMT) as unknown as Option;
    expect(o.xAxis.type).toBe('value');
    expect(o.series.map((s) => s.type)).toEqual(['custom', 'custom', 'line', 'line']);
    expect(o.series[2]!.data[0]).toEqual([0, k(82)]);
    expect(o.xAxis.axisLabel.formatter(0)).toBe('окт ’25');
  });

  it('flow (a month): running totals, the usual month dashed, days after today not drawn, every 5th day labelled', () => {
    const o = flowChartOption(MONTH_VIEW, FMT) as unknown as Option;
    const spending = o.series.find((s) => s.id === 'spending')!;
    expect(spending.data[1]).toEqual([1, k(2)]);
    expect(spending.data[21]).toEqual([21, null]);
    expect(o.series.find((s) => s.id === 'usual')!.lineStyle!.type).toBe('dashed');
    expect([0, 1, 4].map((x) => o.xAxis.axisLabel.formatter(x))).toEqual(['1', '', '5']);
  });

  it('lines: one series per row that is on; hovering fades the others; the share in percent', () => {
    const rows = categoryRows(RANGE.categories, 12);
    const o = linesOption(RANGE, rows, new Set(['groceries', 'cafes']), 'cafes', 'share', FMT) as unknown as Option;
    expect(o.series.map((s) => s.id)).toEqual(['groceries', 'cafes']);
    expect(o.series[0]!.lineStyle!.opacity).toBeLessThan(0.5);
    expect((o.series[1]!.data[0] as [number, number])[1]).toBeCloseTo(12.5);
  });

  it('a small chart: the bars, the peak solid, the dashed mean', () => {
    const row = categoryRows(RANGE.categories, 12).find((r) => r.key === 'travel')!;
    const o = miniOption(RANGE, row) as unknown as { series: Array<{ data: Array<{ itemStyle: { opacity: number } }>; markLine: { data: Array<{ yAxis: number }> } }> };
    expect(o.series[0]!.data[8]!.itemStyle.opacity).toBe(1);
    expect(o.series[0]!.data[0]!.itemStyle.opacity).toBe(0.45);
    expect(o.series[0]!.markLine.data[0]!.yAxis).toBe(row.total / 12);
  });
});

let answer: AnalyticsOverview = RANGE;
const getAnalyticsOverview = vi.fn(async (_q: AnalyticsQuery) => answer);
vi.mock('@/shared/api', () => ({ balanceApi: { getAnalyticsOverview: (...a: unknown[]) => getAnalyticsOverview(...(a as [AnalyticsQuery])) } }));

describe('the analytics screen mounted', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    getAnalyticsOverview.mockClear();
    answer = RANGE;
    localStorage.clear();
  });

  async function mountScreen() {
    const { i18n } = await import('@/shared/lib/i18n.ts');
    const { AnalyticsFeature } = await import('@/features/analytics-overview');
    const w = mount(AnalyticsFeature, { global: { plugins: [i18n] } });
    await flushPromises();
    return w;
  }
  const segment = (w: Awaited<ReturnType<typeof mountScreen>>, text: string) => w.findAll('.v-sc__item').find((b) => b.text().includes(text))!;

  it('asks for the period store\'s range; shows the KPIs, the chart, what changed and the heatmap by default', async () => {
    const { useRangeStore } = await import('@/entities/period');
    const w = await mountScreen();
    const { from, to } = useRangeStore().range;
    expect(getAnalyticsOverview.mock.calls[0]?.[0]).toEqual({ from, to });
    expect(w.findAll('[data-test="kpi"]')).toHaveLength(4);
    for (const s of ['Доход и расходы', 'Что изменилось', 'Для сравнения: окт 2024 – сен 2025', 'Категории']) expect(w.text()).toContain(s);
    expect(w.findAll('[data-test="change"]')).toHaveLength(5);
    expect(w.find('[role="table"][aria-label="Тепловая карта"]').exists()).toBe(true);
    // The heatmap shows every category (9) under its header row, no «Other N».
    expect(w.findAll('[role="table"] [role="row"]')).toHaveLength(10);
    // Every grid item takes a track (an sr-only item is absolutely placed and would shift the rows); names stay pinned left, the average right.
    const heat = w.find('[role="table"][aria-label="Тепловая карта"]');
    expect(heat.findAll('[role="row"] > *').filter((c) => c.classes('sr-only'))).toHaveLength(0);
    expect(heat.findAll('[role="rowheader"]').every((c) => c.classes('sticky'))).toBe(true);
    expect(heat.findAll('[role="row"] > :last-child').every((c) => c.classes('sticky') && c.classes('right-0'))).toBe(true);
    expect(w.find('.v-sc__item[aria-pressed="true"]').text()).toContain('Тепловая карта');

    // Hover: the cell lights its row and column and fades the rest; leaving the table clears it.
    const rowsOf = () => heat.findAll('[role="row"]').slice(1);
    await rowsOf()[1]!.findAll('[role="cell"]')[2]!.trigger('mouseenter');
    expect(heat.findAll('[role="columnheader"]')[3]!.classes()).toContain('font-semibold');
    expect(rowsOf()[1]!.findAll('[role="cell"]')[2]!.classes()).toContain('ring-2');
    expect(rowsOf()[1]!.findAll('[role="cell"]')[0]!.classes()).not.toContain('opacity-40');
    expect(rowsOf()[0]!.findAll('[role="cell"]')[2]!.classes()).not.toContain('opacity-40');
    expect(rowsOf()[0]!.findAll('[role="cell"]')[0]!.classes()).toContain('opacity-40');
    await heat.trigger('mouseleave');
    expect(heat.findAll('.opacity-40')).toHaveLength(0);
  });

  it('the segmented control switches the views; a «What changed» row opens «Lines» with that category alone', async () => {
    const w = await mountScreen();
    await segment(w, 'Мини-графики').trigger('click');
    expect(w.findAll('[data-test="mini"]')).toHaveLength(8);
    await segment(w, 'Сравнение').trigger('click');
    expect(w.find('[role="table"][aria-label="Сравнение"]').exists()).toBe(true);
    await w.findAll('[data-test="change"]')[0]!.trigger('click');
    expect(w.find('.v-sc__item[aria-pressed="true"]').text()).toContain('Линии');
    const pressed = w.findAll('[data-test="line-chip"][aria-pressed="true"]');
    expect(pressed.map((c) => c.text())).toEqual([expect.stringContaining('Путешествия')]);
  });

  it('lines: the top 5 on by default; a chip toggles its line; «All» turns every row on', async () => {
    const w = await mountScreen();
    await segment(w, 'Линии').trigger('click');
    const chips = () => w.findAll('[data-test="line-chip"]');
    expect(chips().filter((c) => c.attributes('aria-pressed') === 'true')).toHaveLength(5);
    await chips()[0]!.trigger('click');
    expect(chips()[0]!.attributes('aria-pressed')).toBe('false');
    await w.findAll('button').find((b) => b.text() === 'Все')!.trigger('click');
    expect(chips().every((c) => c.attributes('aria-pressed') === 'true')).toBe(true);
  });

  it('one month: the running-totals subtitle; the heatmap columns are weeks', async () => {
    answer = MONTH_VIEW;
    const w = await mountScreen();
    expect(w.text()).toContain('Нарастающим итогом с 1-го числа');
    expect(w.findAll('[role="columnheader"]').map((c) => c.text())).toContain('1–6');
  });

  it('a failure and an empty period have their texts', async () => {
    getAnalyticsOverview.mockRejectedValueOnce(new Error('x'));
    expect((await mountScreen()).text()).toContain('Не удалось загрузить аналитику');
    answer = { ...RANGE, totals: { income: 0, spending: 0, prev: null }, categories: [] };
    const w = await mountScreen();
    expect(w.text()).toContain('За этот период данных нет.');
    expect(w.text()).not.toContain('Что изменилось');
  });
});
