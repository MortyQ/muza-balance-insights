// @vitest-environment happy-dom
// The month pace of the balances block (spec desktop-balance-cards, «Month pace»): the view built from one month of the
// analytics answer, its chart option, and the panel's figures; split by banks (spec desktop-spending-split). balanceApi
// is never called here.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import type { AnalyticsOverview } from '@contract/api.ts';
import { moneyFormat } from '@/entities/currency-display';
import { paceBanks, paceChartOption, paceLegend, paceTooltip, paceView } from '@/features/balances/utils.ts';
import { usePaceSplit } from '@/features/balances/composables/usePaceSplit.ts';

vi.mock('@/shared/ui/components/charts/VChart.vue', async () => {
  const { defineComponent, h } = await import('vue');
  return { default: defineComponent({ props: { option: Object }, setup: () => () => h('div', { 'data-test': 'chart' }) }) };
});
const { default: PacePanel } = await import('@/features/balances/components/PacePanel.vue');
const { i18n } = await import('@/shared/lib');

function month(
  states: Array<'full' | 'running' | 'none'>,
  spending: number[],
  usual: number[] | null,
  spendingByBank: AnalyticsOverview['spendingByBank'] = [],
): AnalyticsOverview {
  return {
    from: '2026-10',
    to: '2026-10',
    unit: 'day',
    buckets: states.map((state, i) => ({ key: `2026-10-${String(i + 1).padStart(2, '0')}`, state })),
    income: states.map(() => 0),
    spending,
    spendingByBank,
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
    expect(v).toMatchObject({ days: ['1', '2', '3', '4'], dates: ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04'], spent: [100, 300, 350, null], last: 2, running: true, spentTotal: 350, usualByNow: 240, perDay: 1234 });
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

describe('paceTooltip', () => {
  const money = (n: number) => `${n} ₴`;
  const running = () => paceView(month(['full', 'running', 'none'], [100, 50, 0], [80, 200, 300]), null)!;

  it('a day with data and a usual month: the date, spent, usual by that day, the difference', () => {
    expect(paceTooltip(running(), 0, money)).toBe('1 октября\nПотрачено: 100 ₴\nОбычно к этому дню: 80 ₴\nНа 20 ₴ больше обычного');
    expect(paceTooltip(running(), 1, money)).toBe('2 октября\nПотрачено: 150 ₴\nОбычно к этому дню: 200 ₴\nНа 50 ₴ меньше обычного');
  });

  it('a day after today: the usual only', () => {
    expect(paceTooltip(running(), 2, money)).toBe('3 октября\nОбычно к этому дню: 300 ₴');
  });

  it('no usual month: spent only', () => {
    expect(paceTooltip(paceView(month(['full', 'full'], [10, 20], null), null)!, 1, money)).toBe('2 октября\nПотрачено: 30 ₴');
  });

  it('the chart shows it for the day under the pointer', () => {
    const v = running();
    const o = paceChartOption(v, money) as { tooltip: { trigger: string; formatter: (ps: Array<{ dataIndex: number }>) => string } };
    expect(o.tooltip.trigger).toBe('axis');
    expect(o.tooltip.formatter([{ dataIndex: 1 }])).toBe(paceTooltip(v, 1, money));
  });
});

describe('PacePanel', () => {
  const fmt = moneyFormat(null, { main: 980, also: { uah: false, usd: false, eur: false } });
  const mountPanel = (v: ReturnType<typeof paceView>, offered = false) =>
    mount(PacePanel, { props: { view: v!, fmt, offered, split: 'together', banks: null }, global: { plugins: [i18n] } });

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

describe('the pace by banks', () => {
  const MONO = [60, 0, 0];
  const PRIVAT = [40, 30, 0];
  const byBanks = () => month(['full', 'running', 'none'], [100, 30, 0], [50, 100, 150], [
    { provider: 'monobank', values: MONO },
    { provider: 'privatbank', values: PRIVAT },
  ]);

  it('each bank added up over the same days as the month; the parts add up to the total', () => {
    const v = paceView(byBanks(), null)!;
    expect(v.banks).toEqual([
      { provider: 'monobank', spent: [60, 60, null] },
      { provider: 'privatbank', spent: [40, 70, null] },
    ]);
    v.spent.forEach((s, i) => {
      if (s !== null) expect(v.banks.reduce((sum, b) => sum + (b.spent[i] ?? 0), 0)).toBe(s);
    });
  });

  it('banks only while «By banks» is chosen and offered, named and coloured by the bank', () => {
    const v = paceView(byBanks(), null)!;
    expect(paceBanks(v, true, 'together')).toBeNull();
    expect(paceBanks(v, false, 'banks')).toBeNull();
    expect(paceBanks(null, true, 'banks')).toBeNull();
    expect(paceBanks(v, true, 'banks')?.map((b) => b.name)).toEqual(['Monobank', 'PrivatBank']);
  });

  it('together draws exactly what it drew before; by banks a stacked area per bank under the unfilled month line', () => {
    const v = paceView(byBanks(), null)!;
    expect(JSON.stringify(paceChartOption(v, String, null))).toBe(JSON.stringify(paceChartOption(v)));
    const o = paceChartOption(v, String, paceBanks(v, true, 'banks')) as {
      series: Array<{ stack?: string; data: unknown; areaStyle?: { color: string }; lineStyle: { type?: string; color: string }; markPoint?: unknown }>;
    };
    expect(o.series.map((s) => s.stack ?? s.lineStyle.type ?? 'line')).toEqual(['dashed', 'banks', 'banks', 'line']);
    expect(o.series[1]).toMatchObject({ data: [60, 60, null], areaStyle: { color: 'var(--foreground)', opacity: 0.5 }, lineStyle: { width: 0 } });
    expect(o.series[2]?.data).toEqual([40, 70, null]);
    expect(o.series[3]?.areaStyle).toBeUndefined();
    expect(o.series[3]?.markPoint).toBeDefined();
  });

  it('the tooltip names each bank\'s part after «Spent»', () => {
    const v = paceView(byBanks(), null)!;
    const banks = paceBanks(v, true, 'banks');
    expect(paceTooltip(v, 1, (n) => `${n} ₴`, banks)).toBe(
      '2 октября\nПотрачено: 130 ₴\n  Monobank: 60 ₴\n  PrivatBank: 70 ₴\nОбычно к этому дню: 100 ₴\nНа 30 ₴ больше обычного',
    );
    const o = paceChartOption(v, (n) => `${n} ₴`, banks) as { tooltip: { formatter: (ps: Array<{ dataIndex: number }>) => string } };
    expect(o.tooltip.formatter([{ dataIndex: 1 }])).toBe(paceTooltip(v, 1, (n) => `${n} ₴`, banks));
  });

  it('the legend: each bank drawn with its colour and its amount by the last day, adding up to «Spent»; none together', () => {
    const v = paceView(byBanks(), null)!;
    const items = paceLegend(v, paceBanks(v, true, 'banks'));
    expect(items).toEqual([
      { provider: 'monobank', name: 'Monobank', color: 'var(--foreground)', swatch: 'color-mix(in oklch, var(--foreground) 50%, transparent)', amount: 60 },
      { provider: 'privatbank', name: 'PrivatBank', color: expect.any(String), swatch: expect.stringMatching(/ 50%, transparent\)$/), amount: 70 },
    ]);
    expect(items.reduce((sum, i) => sum + i.amount, 0)).toBe(v.spentTotal);
    expect(paceLegend(v, null)).toEqual([]);
  });

  it('the panel shows the legend by banks only', () => {
    const fmt = moneyFormat(null, { main: 980, also: { uah: false, usd: false, eur: false } });
    const view = paceView(byBanks(), null)!;
    const panel = (banks: ReturnType<typeof paceBanks>) =>
      mount(PacePanel, { props: { view, fmt, offered: true, split: banks ? ('banks' as const) : ('together' as const), banks }, global: { plugins: [i18n] } });
    expect(panel(null).find('[data-test="pace-legend"]').exists()).toBe(false);
    const legend = panel(paceBanks(view, true, 'banks')).get('[data-test="pace-legend"]');
    expect(legend.findAll('li').map((li) => li.text())).toEqual([`Monobank${fmt.money(60)}`, `PrivatBank${fmt.money(70)}`]);
  });

  it('the menu is there only while two or more banks are on, and says the choice', async () => {
    const fmt = moneyFormat(null, { main: 980, also: { uah: false, usd: false, eur: false } });
    const props = { view: paceView(byBanks(), null)!, fmt, split: 'together' as const, banks: null };
    expect(mount(PacePanel, { props: { ...props, offered: false }, global: { plugins: [i18n] } }).find('[aria-label="Настройки темпа"]').exists()).toBe(false);
    const w = mount(PacePanel, { props: { ...props, offered: true }, global: { plugins: [i18n] }, attachTo: document.body });
    document.body.querySelector<HTMLElement>('[aria-label="Настройки темпа"]')!.click();
    await new Promise((r) => setTimeout(r));
    const segments = Array.from(document.body.querySelectorAll<HTMLButtonElement>('[role="group"] button'));
    expect(segments.map((b) => b.textContent?.trim())).toEqual(['Вместе', 'По банкам']);
    segments[1]!.click();
    expect(w.emitted('split')).toEqual([['banks']]);
    w.unmount();
  });
});

describe('usePaceSplit', () => {
  beforeEach(() => localStorage.clear());

  it('together at first; a choice is remembered under its own key', () => {
    expect(usePaceSplit().split.value).toBe('together');
    usePaceSplit().setSplit('banks');
    expect(localStorage.getItem('home.pace.split')).toBe('banks');
    expect(usePaceSplit().split.value).toBe('banks');
    expect(localStorage.getItem('spending.view')).toBeNull();
  });

  it('storage that throws: together, and a choice still holds in memory', () => {
    const get = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const s = usePaceSplit();
    expect(s.split.value).toBe('together');
    s.setSplit('banks');
    expect(s.split.value).toBe('banks');
    get.mockRestore();
    set.mockRestore();
  });
});
