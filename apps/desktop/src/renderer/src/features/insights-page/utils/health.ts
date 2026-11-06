import type { InsightsOverview, Standing } from '@contract/api.ts';
import { CHART_TOOLTIP } from '@/entities/operations';
import { monthShortName, t } from '@/shared/lib';
import type { ChartOption } from '@/shared/ui';
import type { BudgetCardView, ChartMetric, HealthChartView, HealthItemView, HealthView, HelpView } from '../types.ts';
import { monthsText, percent } from './format.ts';

// «Financial health» (spec desktop-insights-health): the shares chart from the overview's history and the checklist
// against guides. Standings come from the data process (core rules); here they are only worded.

const GUIDE: Record<ChartMetric, number> = { left: 20, wants: 30 };

const metricName = (m: ChartMetric) => t(m === 'left' ? 'insights.budget.left' : 'entities.categoryKind.wants');

/** One metric's chart; the left share should rise, the wants share fall. */
function chartOf(v: InsightsOverview, metric: ChartMetric): HealthChartView {
  const points = v.history.map((h) => ({ month: h.month, label: monthShortName(Number(h.month.slice(5, 7))), value: h[metric] }));
  const known = points.filter((p): p is typeof p & { value: number } => p.value !== null);
  const first = known[0];
  const last = known.at(-1);
  const diff = first && last && known.length >= 2 ? last.value - first.value : null;
  const up = metric === 'left';
  const name = metricName(metric);
  return {
    metric,
    name,
    points,
    guide: GUIDE[metric],
    guideText: t('insights.health.chart.guide', { n: GUIDE[metric] }),
    latest: last ? percent(last.value) : null,
    change: diff === null ? null : t('insights.health.chart.change', { diff: `${diff > 0 ? '+' : diff < 0 ? '−' : ''}${Math.abs(diff)}`, n: points.length }),
    changeTone: diff === null || diff === 0 ? 'neutral' : diff > 0 === up ? 'good' : 'bad',
    text: t('insights.health.chart.text', {
      name,
      list: points.map((p) => `${p.label} ${p.month.slice(0, 4)} — ${p.value === null ? t('insights.health.chart.noIncome') : percent(p.value)}`).join(', '),
    }),
  };
}

const standingText = (s: Standing | null) => (s ? t(`insights.health.standing.${s}`) : '');

/** The checklist: shares from the income bar's parts and the budget rows, then the reserve and the limits. */
function itemsOf(v: InsightsOverview, b: BudgetCardView): HealthItemView[] {
  const m = v.budget.month;
  const pending = m ? null : t(v.period.incomplete ? 'insights.health.checklist.pending' : 'insights.health.checklist.noIncome');
  const helpOf = (key: string): HelpView => (b.parts?.find((p) => p.key === key)?.help ?? b.rows.find((r) => r.key === key)?.help)!;
  const share = (key: 'left' | 'essential' | 'wants' | 'fixed' | 'debt', label: string, value: number | undefined, guide: string): HealthItemView => ({
    key,
    label,
    value: value === undefined ? '—' : percent(value),
    guide,
    standing: v.standing[key],
    standingText: standingText(v.standing[key]),
    note: pending,
    help: m ? helpOf(key) : { title: label, lines: [pending!] },
  });
  const atLeast = (n: number) => t('insights.health.guide.atLeast', { n });
  const atMost = (n: number) => t('insights.health.guide.atMost', { n });
  const items: HealthItemView[] = [
    share('left', t('insights.budget.left'), m?.split.left, atLeast(20)),
    share('essential', t('entities.categoryKind.essential'), m?.split.essential, atMost(50)),
    share('wants', t('entities.categoryKind.wants'), m?.split.wants, atMost(30)),
    share('fixed', t('insights.budget.fixed'), m?.fixedShare, atMost(60)),
    share('debt', t('insights.budget.debt'), m?.debtShare, atMost(30)),
  ];
  const r = v.budget.reserve;
  items.push({
    key: 'reserve',
    label: t('insights.budget.reserve'),
    value: r ? monthsText(r.months) : '—',
    guide: t('insights.health.guide.reserve'),
    standing: v.standing.reserve,
    standingText: standingText(v.standing.reserve),
    note: r ? null : t('insights.budget.reserveNone'),
    help: helpOf('reserve'),
  });
  if (v.monthlyLimits > 0) {
    const value =
      v.limitsOver.length > 0
        ? t('insights.health.limits.over', { n: v.limitsOver.length })
        : v.limitsAhead.length > 0
          ? t('insights.health.limits.ahead', { n: v.limitsAhead.length })
          : t('insights.health.limits.within');
    items.push({
      key: 'limits',
      label: t('insights.health.limits.title'),
      value,
      guide: t('insights.health.guide.limits'),
      standing: v.standing.limits,
      standingText: standingText(v.standing.limits),
      note: null,
      help: { title: t('insights.health.limits.title'), lines: [t('insights.health.limits.help')] },
    });
  }
  return items;
}

/** The whole block; the chart only with a history (3 whole months or more). */
export function healthView(v: InsightsOverview, budget: BudgetCardView): HealthView {
  const items = itemsOf(v, budget);
  const placed = items.filter((i) => i.standing !== null);
  return {
    chart: v.history.length > 0 ? { left: chartOf(v, 'left'), wants: chartOf(v, 'wants') } : null,
    budget,
    items,
    count: placed.length > 0 ? t('insights.health.checklist.count', { n: placed.filter((i) => i.standing === 'within').length, m: placed.length }) : null,
  };
}

/** The chart: the share as a line with points, a gap for a month without income, the guide as a dashed line. */
export function healthChartOption(c: Readonly<HealthChartView>): ChartOption {
  const color = 'var(--success)';
  return {
    grid: { left: 4, right: 12, top: 16, bottom: 22, containLabel: true },
    tooltip: {
      ...CHART_TOOLTIP,
      trigger: 'axis',
      axisPointer: { type: 'line', lineStyle: { color: 'var(--border)' } },
      formatter: (ps: Array<{ dataIndex: number }>) => {
        const p = c.points[ps[0]?.dataIndex ?? 0];
        return p ? `${p.label} ${p.month.slice(0, 4)}: ${p.value === null ? t('insights.health.chart.noIncome') : percent(p.value)}` : '';
      },
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: c.points.map((p) => p.label),
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { fontSize: 10, color: 'var(--foreground-muted)' },
    },
    yAxis: {
      type: 'value',
      splitNumber: 3,
      axisLabel: { fontSize: 10, color: 'var(--foreground-muted)', formatter: (n: number) => `${n}%` },
      splitLine: { lineStyle: { color: 'var(--border-subtle)' } },
    },
    series: [
      {
        type: 'line',
        data: c.points.map(() => c.guide),
        symbol: 'none',
        silent: true,
        lineStyle: { type: 'dashed', width: 1.5, color: 'color-mix(in oklch, var(--foreground) 35%, var(--surface))' },
      },
      {
        type: 'line',
        data: c.points.map((p) => p.value),
        connectNulls: false,
        symbol: 'circle',
        symbolSize: 7,
        lineStyle: { width: 2, color },
        itemStyle: { color, borderColor: 'var(--surface)', borderWidth: 2 },
        areaStyle: { color, opacity: 0.08 },
      },
    ],
  };
}
