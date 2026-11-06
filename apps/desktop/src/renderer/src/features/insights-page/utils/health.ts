import type { InsightsOverview, Standing } from '@contract/api.ts';
import { CHART_TOOLTIP } from '@/entities/operations';
import { monthName, monthShortName, t } from '@/shared/lib';
import type { ChartOption } from '@/shared/ui';
import type { BudgetCardView, ChartMetric, HealthChartView, HealthItemView, HealthView, HelpView } from '../types.ts';
import { monthsText, percent } from './format.ts';

// «Financial health» (spec desktop-insights-health): the shares chart from the overview's history and the checklist
// against guides. Standings come from the data process (core rules); here they are only worded.

const GUIDE: Record<ChartMetric, number> = { left: 20, wants: 30 };
/** The «near» band of core's rule (NEAR_POINTS), for the legend only. */
const NEAR = 5;

const monthNo = (ym: string) => Number(ym.slice(5, 7));
const monthsBetween = (a: string, b: string) => (Number(b.slice(0, 4)) - Number(a.slice(0, 4))) * 12 + monthNo(b) - monthNo(a);

/** One metric's chart (spec desktop-insights-health «Shares chart»), in words a newcomer reads. */
function chartOf(v: InsightsOverview, metric: ChartMetric): HealthChartView {
  const points = v.history.map((h) => ({
    month: h.month,
    label: monthShortName(monthNo(h.month)),
    value: h[metric],
    standing: metric === 'left' ? h.leftStanding : h.wantsStanding,
  }));
  const known = points.filter((p): p is typeof p & { value: number } => p.value !== null);
  const first = known[0];
  const last = known.at(-1);
  const guide = GUIDE[metric];
  const key = `insights.health.chart.${metric}` as const;
  const sentence = (p: { month: string; value: number }) => {
    const month = monthName(monthNo(p.month));
    if (metric === 'left' && p.value < 0) return t('insights.health.chart.left.negative', { month });
    return t(`${key}.now`, { month, share: percent(p.value) });
  };
  const legend: HealthChartView['legend'] =
    metric === 'left'
      ? [
          { standing: 'within', text: t('insights.health.chart.left.legend.within', { n: guide }) },
          { standing: 'near', text: t('insights.health.chart.left.legend.near', { from: guide - NEAR, to: guide - 1 }) },
          { standing: 'outside', text: t('insights.health.chart.left.legend.outside') },
        ]
      : [
          { standing: 'within', text: t('insights.health.chart.wants.legend.within', { n: guide }) },
          { standing: 'near', text: t('insights.health.chart.wants.legend.near', { from: guide + 1, to: guide + NEAR }) },
          { standing: 'outside', text: t('insights.health.chart.wants.legend.outside') },
        ];
  const title = t(`${key}.title`);
  return {
    metric,
    tab: t(`${key}.tab`),
    title,
    hint: t(`${key}.hint`),
    points,
    guide,
    guideText: t('insights.health.chart.guide', { n: guide }),
    latest: last ? { value: percent(last.value), standing: last.standing, sentence: sentence(last) } : null,
    before: first && last && first !== last ? t('insights.health.chart.before', { n: monthsBetween(first.month, last.month), share: percent(first.value) }) : null,
    legend,
    belowZero: metric === 'left' && known.some((p) => p.value < 0) ? t('insights.health.chart.left.belowZero') : null,
    text: t('insights.health.chart.text', {
      name: title,
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
  const share = (key: 'left' | 'essential' | 'wants' | 'fixed' | 'debt', label: string, value: number, guide: string): HealthItemView => ({
    key,
    label,
    value: percent(value),
    guide,
    standing: v.standing[key],
    standingText: standingText(v.standing[key]),
    note: null,
    help: helpOf(key),
  });
  const atLeast = (n: number) => t('insights.health.guide.atLeast', { n });
  const atMost = (n: number) => t('insights.health.guide.atMost', { n });
  const items: HealthItemView[] = m
    ? [
        share('left', t('insights.budget.left'), m.split.left, atLeast(20)),
        share('essential', t('entities.categoryKind.essential'), m.split.essential, atMost(50)),
        share('wants', t('entities.categoryKind.wants'), m.split.wants, atMost(30)),
        share('fixed', t('insights.budget.fixed'), m.fixedShare, atMost(60)),
        share('debt', t('insights.budget.debt'), m.debtShare, atMost(30)),
      ]
    : [
        // No finished month with income: one row says when the five shares come, instead of five rows saying it.
        {
          key: 'shares',
          label: t('insights.health.checklist.shares'),
          value: '—',
          guide: '',
          standing: null,
          standingText: '',
          note: pending,
          help: { title: t('insights.health.checklist.shares'), lines: [t(v.period.incomplete ? 'insights.budget.running' : 'insights.budget.noIncome')] },
        },
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

/** A bar's colour by its standing; a month without income has no bar. */
export const STANDING_COLOR: Readonly<Record<Standing, string>> = {
  within: 'color-mix(in oklch, var(--success) 80%, transparent)',
  near: 'color-mix(in oklch, var(--warning) 85%, transparent)',
  outside: 'color-mix(in oklch, var(--danger) 80%, transparent)',
};

/** The chart: a bar per month coloured by its standing, its value on it, zero as a solid line, the guide dashed. */
export function healthChartOption(c: Readonly<HealthChartView>): ChartOption {
  const values = c.points.flatMap((p) => (p.value === null ? [] : [p.value]));
  return {
    grid: { left: 4, right: 8, top: 26, bottom: 4, containLabel: true },
    tooltip: {
      ...CHART_TOOLTIP,
      trigger: 'axis',
      axisPointer: { type: 'shadow', shadowStyle: { color: 'color-mix(in oklch, var(--foreground) 5%, transparent)' } },
      formatter: (ps: Array<{ dataIndex: number }>) => {
        const p = c.points[ps[0]?.dataIndex ?? 0];
        return p ? `${p.label} ${p.month.slice(0, 4)}: ${p.value === null ? t('insights.health.chart.noIncome') : percent(p.value)}` : '';
      },
    },
    xAxis: {
      type: 'category',
      data: c.points.map((p) => p.label),
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { fontSize: 11, color: 'var(--foreground-muted)' },
    },
    yAxis: {
      type: 'value',
      // Room for the guide and the labels even when every bar is small.
      min: Math.min(0, ...values.map((n) => n - 10)),
      max: Math.max(c.guide + 10, ...values.map((n) => n + 10)),
      show: false,
    },
    series: [
      {
        type: 'bar',
        barMaxWidth: 44,
        data: c.points.map((p) => ({
          value: p.value,
          itemStyle: { color: p.standing ? STANDING_COLOR[p.standing] : 'transparent', borderRadius: (p.value ?? 0) < 0 ? [0, 0, 5, 5] : [5, 5, 0, 0] },
          label: {
            show: p.value !== null,
            position: (p.value ?? 0) < 0 ? 'bottom' : 'top',
            formatter: () => (p.value === null ? '' : percent(p.value)),
            fontSize: 12,
            color: 'var(--foreground)',
          },
        })),
        markLine: {
          silent: true,
          symbol: 'none',
          label: { show: false },
          data: [
            { yAxis: 0, lineStyle: { type: 'solid', width: 1, color: 'var(--border)' } },
            { yAxis: c.guide, lineStyle: { type: 'dashed', width: 1.5, color: 'color-mix(in oklch, var(--foreground) 40%, var(--surface))' } },
          ],
        },
      },
    ],
  };
}
