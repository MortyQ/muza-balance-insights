// @vitest-environment happy-dom
// The month pace of the balances block (spec desktop-balance-cards, «Month pace»): the view built from one month of the
// analytics answer, its chart option, and the panel's figures. balanceApi is never called here.
import { describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import type { AnalyticsOverview } from '@contract/api.ts';
import { moneyFormat } from '@/entities/currency-display';
import { paceChartOption, paceView } from '@/features/balances/utils.ts';

vi.mock('@/shared/ui/components/charts/VChart.vue', async () => {
  const { defineComponent, h } = await import('vue');
  return { default: defineComponent({ props: { option: Object }, setup: () => () => h('div', { 'data-test': 'chart' }) }) };
});
const { default: PacePanel } = await import('@/features/balances/components/PacePanel.vue');
const { i18n } = await import('@/shared/lib');

function month(states: Array<'full' | 'running' | 'none'>, spending: number[], usual: number[] | null): AnalyticsOverview {
  return {
    from: '2026-10',
    to: '2026-10',
    unit: 'day',
    buckets: states.map((state, i) => ({ key: `2026-10-${String(i + 1).padStart(2, '0')}`, state })),
    income: states.map(() => 0),
    spending,
    totals: { income: 0, spending: spending.reduce((a, b) => a + b, 0), prev: null },
    compare: null,
    usual,
    categories: [],
    rates: null,
    leftOut: [],
  };
}

describe('paceView', () => {
  it('a running month: added up to today, nothing after it; usual by the same day; per day kept', () => {
    const v = paceView(month(['full', 'full', 'running', 'none'], [100, 200, 50, 0], [80, 160, 240, 320]), 1234);
    expect(v).toMatchObject({ days: ['1', '2', '3', '4'], spent: [100, 300, 350, null], last: 2, running: true, spentTotal: 350, usualByNow: 240, perDay: 1234 });
  });

  it('a past month: the whole month, no per day', () => {
    const v = paceView(month(['full', 'full'], [100, 200], [90, 180]), 1234);
    expect(v).toMatchObject({ last: 1, running: false, spentTotal: 300, usualByNow: 180, perDay: null });
    expect(v?.spentTotal).toBe(v?.spent.at(-1));
  });

  it('days before the first data are not drawn, and the sum starts there', () => {
    const v = paceView(month(['none', 'full', 'full'], [0, 40, 60], null), null);
    expect(v?.spent).toEqual([null, 40, 100]);
    expect(v).toMatchObject({ usual: null, usualByNow: null });
  });

  it('a month without data: no pace', () => {
    expect(paceView(month(['none', 'none'], [0, 0], null), null)).toBeNull();
  });
});

describe('paceChartOption', () => {
  it('as on the home mockup: a filled area under the month, today\'s amount in a pill, amounts on a faint grid', () => {
    const o = paceChartOption(paceView(month(['full', 'running', 'none'], [10, 20, 0], [5, 10, 15]), null)!, (n) => `${n} ₴`) as {
      yAxis: { splitLine: unknown; axisLabel: { formatter: (n: number) => string } };
      series: Array<{ areaStyle?: unknown; markPoint?: { data: Array<{ label: { formatter: string } }> } }>;
    };
    expect(o.series[1]?.areaStyle).toBeDefined();
    expect(o.series[0]?.areaStyle).toBeUndefined();
    expect(o.series[1]?.markPoint?.data[0]?.label.formatter).toBe('30 ₴');
    expect(o.yAxis.axisLabel.formatter(20)).toBe('20 ₴');
    expect(o.yAxis.splitLine).toBeDefined();
  });

  it('the usual dashed before the month; today marked only while the month runs', () => {
    const running = paceChartOption(paceView(month(['full', 'running', 'none'], [10, 20, 0], [5, 10, 15]), null)!) as { series: Array<{ lineStyle: { type?: string }; markPoint?: { data: unknown[] } }> };
    expect(running.series.map((s) => s.lineStyle.type ?? 'solid')).toEqual(['dashed', 'solid']);
    expect(running.series[1]?.markPoint?.data).toEqual([expect.objectContaining({ coord: [1, 30] })]);
    const past = paceChartOption(paceView(month(['full', 'full'], [10, 20], null), null)!) as { series: Array<{ markPoint?: { data: unknown[] } }> };
    expect(past.series).toHaveLength(1);
    expect(past.series[0]?.markPoint?.data).toEqual([]);
  });
});

describe('PacePanel', () => {
  const fmt = moneyFormat(null, { main: 980, also: { uah: false, usd: false, eur: false } });
  const mountPanel = (v: ReturnType<typeof paceView>) => mount(PacePanel, { props: { view: v!, fmt }, global: { plugins: [i18n] } });

  it('the three figures of a running month', () => {
    const w = mountPanel(paceView(month(['full', 'running'], [10000, 5000], [8000, 12000]), 70000));
    expect(w.find('[data-test="chart"]').exists()).toBe(true);
    const figures = w.findAll('[data-test="pace-figure"]');
    expect(figures).toHaveLength(3);
    expect(figures[0]?.text()).toContain(fmt.money(15000));
    expect(figures[1]?.text()).toContain(fmt.money(12000));
    expect(figures[2]?.text()).toContain(fmt.money(70000));
    expect(w.find('[data-test="pace-no-usual"]').exists()).toBe(false);
  });

  it('without a usual month: only «spent» and the note', () => {
    const w = mountPanel(paceView(month(['full', 'full'], [10000, 5000], null), null));
    expect(w.findAll('[data-test="pace-figure"]')).toHaveLength(1);
    expect(w.find('[data-test="pace-no-usual"]').exists()).toBe(true);
  });
});
