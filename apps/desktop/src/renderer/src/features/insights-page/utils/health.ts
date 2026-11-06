import type { HealthReferences, InsightsOverview, ShareKey, Standing, TrendDirection } from '@contract/api.ts';
import type { MoneyFormat } from '@/entities/currency-display';
import { CHART_TOOLTIP } from '@/entities/operations';
import { monthName, monthShortName, t } from '@/shared/lib';
import type { ChartOption } from '@/shared/ui';
import type { BudgetCardView, ChartMetric, HealthChartView, HealthItemView, HealthTileView, HealthView, HelpView } from '../types.ts';
import { monthsText, percent } from './format.ts';

// «Financial health» (spec desktop-insights-health): the shares chart with the guide and the user's own references,
// the tiles above it, and the checklist in three groups. Standings and references come from the data process (core
// rules); here they are only worded and drawn.

const GUIDE: Record<ChartMetric, number> = { left: 20, wants: 30 };
/** The «near» band of core's rule (NEAR_POINTS), for the legend only. */
const NEAR = 5;
/** Core's UNUSUAL_POINTS: the half-width of the usual band. */
const BAND = 15;

const monthNo = (ym: string) => Number(ym.slice(5, 7));
const monthsBetween = (a: string, b: string) => (Number(b.slice(0, 4)) - Number(a.slice(0, 4))) * 12 + monthNo(b) - monthNo(a);
const nextMonth = (ym: string) => {
  const [y, m] = ym.split('-').map(Number) as [number, number];
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
};

const TREND_ICON: Readonly<Record<TrendDirection, string>> = { better: 'lucide:trending-up', worse: 'lucide:trending-down', same: 'lucide:arrow-right' };
const TREND_TONE: Readonly<Record<TrendDirection, HealthTileView['tone']>> = { better: 'good', worse: 'bad', same: 'neutral' };
const STANDING_TONE: Readonly<Record<Standing, HealthTileView['tone']>> = { within: 'good', near: 'warn', outside: 'bad' };

/** The tiles above the chart: the usual, the trend, and the month (its forecast while it runs). */
function tilesOf(v: InsightsOverview, metric: ChartMetric, h: HealthReferences | null, latest: HealthChartView['latest']): HealthTileView[] {
  const ref = h?.chart[metric] ?? null;
  const known = v.history.filter((x) => x[metric] !== null).length;
  const tiles: HealthTileView[] = [
    {
      key: 'usual',
      label: t('insights.health.tiles.usual'),
      value: ref ? percent(ref.usual) : '—',
      sub: t('insights.health.tiles.usualSub', { n: known, guide: GUIDE[metric] }),
      tone: 'neutral',
      icon: null,
    },
    ref?.trend
      ? {
          key: 'trend',
          label: t('insights.health.tiles.trend'),
          value: t(`insights.health.tiles.${ref.trend.direction}`),
          sub: t('insights.health.tiles.trendSub', { now: percent(ref.trend.now), before: percent(ref.trend.before) }),
          tone: TREND_TONE[ref.trend.direction],
          icon: TREND_ICON[ref.trend.direction],
        }
      : { key: 'trend', label: t('insights.health.tiles.trend'), value: '—', sub: t('insights.health.tiles.trendNone'), tone: 'neutral', icon: null },
  ];
  if (v.period.incomplete) {
    const f = metric === 'left' ? (h?.forecast ?? null) : null;
    tiles.push(
      f
        ? {
            key: 'month',
            label: t('insights.health.tiles.forecast'),
            value: t('insights.health.tiles.forecastValue', { value: percent(f.value) }),
            sub: t('insights.health.tiles.forecastSub', { low: percent(f.low), high: percent(f.high) }),
            tone: STANDING_TONE[f.standing],
            icon: null,
          }
        : metric === 'left'
          ? { key: 'month', label: t('insights.health.tiles.forecast'), value: t('insights.health.tiles.early'), sub: t('insights.health.tiles.earlySub'), tone: 'neutral', icon: null }
          : { key: 'month', label: t('insights.health.tiles.month'), value: '—', sub: t('insights.health.tiles.monthWants'), tone: 'neutral', icon: null },
    );
  } else {
    const versus = h?.versus[metric] ?? null;
    tiles.push({
      key: 'month',
      label: monthName(monthNo(v.month)),
      value: latest?.value ?? '—',
      sub: versus ? directionText(versus) : t('insights.health.tiles.monthPending'),
      tone: latest?.standing ? STANDING_TONE[latest.standing] : 'neutral',
      icon: null,
    });
  }
  return tiles;
}

const directionText = (d: { usual: number; direction: TrendDirection }) =>
  d.direction === 'same' ? t('insights.health.direction.same') : t(`insights.health.direction.${d.direction}`, { usual: percent(d.usual) });

/** One metric's chart (spec desktop-insights-health «Shares chart», «Personal references on the chart»). */
function chartOf(v: InsightsOverview, metric: ChartMetric): HealthChartView {
  const ref = v.health?.chart[metric] ?? null;
  const points = v.history.map((h, i) => ({
    month: h.month,
    label: monthShortName(monthNo(h.month)),
    value: h[metric],
    standing: metric === 'left' ? h.leftStanding : h.wantsStanding,
    unusual: ref?.unusual[i] ?? null,
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
  const f = metric === 'left' && v.period.incomplete ? (v.health?.forecast ?? null) : null;
  const forecast = f
    ? {
        label: monthShortName(monthNo(v.history.length > 0 ? nextMonth(v.history.at(-1)!.month) : v.month)),
        value: f.value,
        low: f.low,
        high: f.high,
        standing: f.standing,
        text: t('insights.health.refs.forecastLabel', { value: percent(f.value) }),
      }
    : null;
  const usual = ref ? { value: ref.usual, low: ref.usual - BAND, high: ref.usual + BAND, text: t('insights.health.refs.usual', { value: percent(ref.usual) }) } : null;
  const references: HealthChartView['references'] = [
    { key: 'guide', text: t('insights.health.refs.guide') },
    ...(usual
      ? [
          { key: 'usual' as const, text: t('insights.health.refs.usualLine') },
          { key: 'band' as const, text: t('insights.health.refs.band') },
        ]
      : []),
    ...(points.some((p) => p.unusual) ? [{ key: 'unusual' as const, text: t('insights.health.refs.unusual') }] : []),
    ...(forecast ? [{ key: 'forecast' as const, text: t('insights.health.refs.forecast') }] : []),
  ];
  const title = t(`${key}.title`);
  const latest = last ? { value: percent(last.value), standing: last.standing, sentence: sentence(last) } : null;
  const mark = (p: (typeof points)[number]) =>
    p.unusual ? ` (${t(p.unusual === 'above' ? 'insights.health.refs.unusualAbove' : 'insights.health.refs.unusualBelow')})` : '';
  return {
    metric,
    tab: t(`${key}.tab`),
    title,
    hint: t(`${key}.hint`),
    points,
    guide,
    guideText: t('insights.health.chart.guide', { n: guide }),
    latest,
    before: first && last && first !== last ? t('insights.health.chart.before', { n: monthsBetween(first.month, last.month), share: percent(first.value) }) : null,
    legend,
    belowZero: metric === 'left' && known.some((p) => p.value < 0) ? t('insights.health.chart.left.belowZero') : null,
    usual,
    forecast,
    tiles: tilesOf(v, metric, v.health, latest),
    references,
    text: t('insights.health.chart.text', {
      name: title,
      list: [
        ...points.map((p) => `${p.label} ${p.month.slice(0, 4)} — ${p.value === null ? t('insights.health.chart.noIncome') : percent(p.value)}${mark(p)}`),
        ...(forecast ? [`${forecast.label} — ${t('insights.health.refs.forecast')} ${forecast.text}`] : []),
        ...(usual ? [usual.text] : []),
      ].join(', '),
    }),
  };
}

const standingText = (s: Standing | null) => (s ? t(`insights.health.standing.${s}`) : '');

const DIRECTION_TONE: Readonly<Record<TrendDirection, 'good' | 'bad' | 'neutral'>> = { better: 'good', worse: 'bad', same: 'neutral' };

/** The checklist in its three groups (spec desktop-insights-health «Checklist groups», «Cushion and spending items»). */
function groupsOf(v: InsightsOverview, b: BudgetCardView, fmt: MoneyFormat): HealthView['groups'] {
  const m = v.budget.month;
  const h = v.health;
  const helpOf = (key: string): HelpView => (b.parts?.find((p) => p.key === key)?.help ?? b.rows.find((r) => r.key === key)?.help)!;
  const item = (o: Omit<HealthItemView, 'standingText' | 'direction' | 'note'> & Partial<Pick<HealthItemView, 'direction' | 'note'>>): HealthItemView => ({
    direction: null,
    note: null,
    ...o,
    standingText: standingText(o.standing),
  });
  const share = (key: ShareKey, label: string, value: number, guide: string): HealthItemView => {
    const d = h?.versus[key] ?? null;
    return item({
      key,
      label,
      value: percent(value),
      guide,
      standing: v.standing[key],
      help: helpOf(key),
      direction: d ? { text: directionText(d), tone: DIRECTION_TONE[d.direction] } : null,
    });
  };
  const atLeast = (n: number) => t('insights.health.guide.atLeast', { n });
  const atMost = (n: number) => t('insights.health.guide.atMost', { n });
  const pending = t(v.period.incomplete ? 'insights.health.checklist.pending' : 'insights.health.checklist.noIncome');

  const month: HealthItemView[] = m
    ? [
        share('left', t('insights.budget.left'), m.split.left, atLeast(20)),
        share('essential', t('entities.categoryKind.essential'), m.split.essential, atMost(50)),
        share('wants', t('entities.categoryKind.wants'), m.split.wants, atMost(30)),
        share('fixed', t('insights.budget.fixed'), m.fixedShare, atMost(60)),
        share('debt', t('insights.budget.debt'), m.debtShare, atMost(30)),
      ]
    : [
        // No finished month with income: one row says when the five shares come, instead of five rows saying it.
        item({
          key: 'shares',
          label: t('insights.health.checklist.shares'),
          value: '—',
          guide: '',
          standing: null,
          note: pending,
          help: { title: t('insights.health.checklist.shares'), lines: [t(v.period.incomplete ? 'insights.budget.running' : 'insights.budget.noIncome')] },
        }),
      ];

  const r = v.budget.reserve;
  const cushion: HealthItemView[] = [
    item({
      key: 'reserve',
      label: t('insights.budget.reserve'),
      value: r ? monthsText(r.months) : '—',
      guide: t('insights.health.guide.reserve'),
      standing: v.standing.reserve,
      note: r ? null : t('insights.budget.reserveNone'),
      help: helpOf('reserve'),
    }),
  ];
  if (h?.redMonths) {
    const label = t('insights.health.items.red');
    cushion.push(
      item({
        key: 'red',
        label,
        value: t('insights.health.items.redValue', { n: h.redMonths.n, of: h.redMonths.of }),
        guide: t('insights.health.items.redGuide'),
        standing: h.redMonths.standing,
        help: { title: label, lines: [t('insights.health.items.redHelp')] },
      }),
    );
  }
  if (h?.income) {
    const label = t('insights.health.items.income');
    cushion.push(
      item({
        key: 'income',
        label,
        value: t('insights.health.items.incomeValue', { share: percent(Math.round((h.income.now / h.income.usual) * 100)) }),
        guide: t('insights.health.items.incomeGuide'),
        standing: h.income.standing,
        help: { title: label, lines: [t('insights.health.items.incomeHelp', { now: fmt.money(h.income.now), usual: fmt.money(h.income.usual) })] },
      }),
    );
  }

  const plans: HealthItemView[] = [];
  const s = h?.spending ?? null;
  if (s) {
    const label = t('insights.health.items.spending');
    plans.push(
      s.kind === 'month'
        ? item({
            key: 'spending',
            label,
            value: t('insights.health.items.spendingValue', { share: percent(Math.round((s.now / s.usual) * 100)) }),
            guide: t('insights.health.items.spendingGuide'),
            standing: s.standing,
            help: { title: label, lines: [t('insights.health.items.spendingHelp', { now: fmt.money(s.now), usual: fmt.money(s.usual) })] },
          })
        : item({
            key: 'spending',
            label,
            value: t('insights.health.items.paceValue', { spent: percent(s.spent), passed: percent(s.passed) }),
            guide: t('insights.health.items.paceGuide'),
            standing: s.standing,
            help: { title: label, lines: [t('insights.health.items.paceHelp', { spent: percent(s.spent), passed: percent(s.passed) })] },
          }),
    );
  }
  if (v.monthlyLimits > 0) {
    const value =
      v.limitsOver.length > 0
        ? t('insights.health.limits.over', { n: v.limitsOver.length })
        : v.limitsAhead.length > 0
          ? t('insights.health.limits.ahead', { n: v.limitsAhead.length })
          : t('insights.health.limits.within');
    plans.push(
      item({
        key: 'limits',
        label: t('insights.health.limits.title'),
        value,
        guide: t('insights.health.guide.limits'),
        standing: v.standing.limits,
        help: { title: t('insights.health.limits.title'), lines: [t('insights.health.limits.help')] },
      }),
    );
  }
  if (h) {
    const label = t('insights.health.items.strong');
    plans.push(
      item({
        key: 'strong',
        label,
        value: String(h.strong.n),
        guide: t('insights.health.items.strongGuide'),
        standing: h.strong.standing,
        help: { title: label, lines: [t('insights.health.items.strongHelp')] },
        showSignals: h.strong.n > 0,
      }),
    );
  }

  return (
    [
      { key: 'month', title: t('insights.health.groups.month'), items: month },
      { key: 'cushion', title: t('insights.health.groups.cushion'), items: cushion },
      { key: 'plans', title: t('insights.health.groups.plans'), items: plans },
    ] as const
  ).filter((g) => g.items.length > 0) as HealthView['groups'];
}

/** The whole block; the chart only with a history (3 whole months or more). */
export function healthView(v: InsightsOverview, budget: BudgetCardView, fmt: MoneyFormat): HealthView {
  const groups = groupsOf(v, budget, fmt);
  const placed = groups.flatMap((g) => g.items).filter((i) => i.standing !== null);
  return {
    chart: v.history.length > 0 ? { left: chartOf(v, 'left'), wants: chartOf(v, 'wants') } : null,
    budget,
    groups,
    count: placed.length > 0 ? t('insights.health.checklist.count', { n: placed.filter((i) => i.standing === 'within').length, m: placed.length }) : null,
  };
}

/** A bar's colour by its standing; a month without income has no bar. */
export const STANDING_COLOR: Readonly<Record<Standing, string>> = {
  within: 'color-mix(in oklch, var(--success) 80%, transparent)',
  near: 'color-mix(in oklch, var(--warning) 85%, transparent)',
  outside: 'color-mix(in oklch, var(--danger) 80%, transparent)',
};

/** The usual line and band's colour. */
export const USUAL_COLOR = 'var(--series-blue)';

/**
 * The chart: a bar per month coloured by its standing with its value on it (▲ / ▼ and a dashed outline when unusual),
 * zero solid, the guide dashed, the user's usual as a line in a light band, and the running month's forecast as a
 * hatched bar with its range.
 */
export function healthChartOption(c: Readonly<HealthChartView>): ChartOption {
  const f = c.forecast;
  const values = [...c.points.flatMap((p) => (p.value === null ? [] : [p.value])), ...(f ? [f.low, f.high] : []), ...(c.usual ? [c.usual.low, c.usual.high] : [])];
  const labels = [...c.points.map((p) => p.label), ...(f ? [f.label] : [])];
  const arrow = (u: 'above' | 'below' | null) => (u === 'above' ? ' ▲' : u === 'below' ? ' ▼' : '');
  const data = [
    ...c.points.map((p) => ({
      value: p.value,
      itemStyle: {
        color: p.standing ? STANDING_COLOR[p.standing] : 'transparent',
        borderRadius: (p.value ?? 0) < 0 ? [0, 0, 5, 5] : [5, 5, 0, 0],
        ...(p.unusual ? { borderColor: 'var(--foreground)', borderWidth: 1.5, borderType: 'dashed' } : {}),
      },
      label: {
        show: p.value !== null,
        position: (p.value ?? 0) < 0 ? 'bottom' : 'top',
        formatter: () => (p.value === null ? '' : `${percent(p.value)}${arrow(p.unusual)}`),
        fontSize: 12,
        fontWeight: p.unusual ? 700 : 400,
        color: 'var(--foreground)',
      },
    })),
    ...(f
      ? [
          {
            value: f.value,
            itemStyle: {
              color: 'color-mix(in oklch, var(--warning) 22%, transparent)',
              borderColor: STANDING_COLOR[f.standing],
              borderWidth: 1.5,
              borderType: 'dashed',
              borderRadius: f.value < 0 ? [0, 0, 5, 5] : [5, 5, 0, 0],
              decal: { symbol: 'rect', dashArrayX: [1, 0], dashArrayY: [2, 5], rotation: -Math.PI / 4, color: STANDING_COLOR[f.standing] },
            },
            label: { show: true, position: f.value < 0 ? 'bottom' : 'top', formatter: () => f.text, fontSize: 12, color: 'var(--foreground)' },
          },
        ]
      : []),
  ];
  return {
    grid: { left: 4, right: 8, top: 26, bottom: 4, containLabel: true },
    tooltip: {
      ...CHART_TOOLTIP,
      trigger: 'axis',
      axisPointer: { type: 'shadow', shadowStyle: { color: 'color-mix(in oklch, var(--foreground) 5%, transparent)' } },
      formatter: (ps: Array<{ dataIndex: number }>) => {
        const i = ps[0]?.dataIndex ?? 0;
        const p = c.points[i];
        if (!p) return f ? `${f.label}: ${t('insights.health.refs.forecast')} ${f.text} (${percent(f.low)} … ${percent(f.high)})` : '';
        return `${p.label} ${p.month.slice(0, 4)}: ${p.value === null ? t('insights.health.chart.noIncome') : percent(p.value)}`;
      },
    },
    xAxis: {
      type: 'category',
      data: labels,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { fontSize: 11, color: 'var(--foreground-muted)' },
    },
    yAxis: {
      type: 'value',
      // Room for the guide, the band and the labels even when every bar is small.
      min: Math.min(0, ...values.map((n) => n - 10)),
      max: Math.max(c.guide + 10, ...values.map((n) => n + 10)),
      show: false,
    },
    series: [
      {
        type: 'bar',
        barMaxWidth: 44,
        data,
        markArea: c.usual
          ? { silent: true, itemStyle: { color: 'color-mix(in oklch, var(--series-blue) 8%, transparent)' }, data: [[{ yAxis: c.usual.low }, { yAxis: c.usual.high }]] }
          : undefined,
        markLine: {
          silent: true,
          symbol: 'none',
          label: { show: false },
          data: [
            { yAxis: 0, lineStyle: { type: 'solid', width: 1, color: 'var(--border)' } },
            { yAxis: c.guide, lineStyle: { type: 'dashed', width: 1.5, color: 'color-mix(in oklch, var(--foreground) 40%, var(--surface))' } },
            ...(c.usual ? [{ yAxis: c.usual.value, lineStyle: { type: 'solid', width: 1.5, color: USUAL_COLOR } }] : []),
            ...(f
              ? [
                  [
                    { coord: [f.label, f.low], lineStyle: { type: 'solid', width: 1.5, color: 'var(--foreground-secondary)' } },
                    { coord: [f.label, f.high] },
                  ],
                ]
              : []),
          ],
        },
      },
    ],
  };
}
