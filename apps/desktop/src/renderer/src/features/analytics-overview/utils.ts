import type { AnalyticsCategory, AnalyticsOverview } from '@contract/api.ts';
import { categoryColor, categoryName } from '@/entities/category';
import type { MoneyFormat } from '@/entities/currency-display';
import { CHART_TOOLTIP, dayMonth } from '@/entities/operations';
import { monthName, monthShortName, t } from '@/shared/lib';
import type { ChartOption } from '@/shared/ui';
import { HEAT_EVEN } from './constants.ts';
import type { CategoryRow, ChangeRow, Column, CompareRow, GapPolygon, HeatRow, KpiView, LinesMode, MiniCard } from './types.ts';

const sum = (xs: readonly number[]): number => xs.reduce((s, x) => s + x, 0);
const decimal = new Intl.NumberFormat('uk-UA', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const signed = (fmt: MoneyFormat, v: number): string => `${v >= 0 ? '+' : '−'}${fmt.money(Math.abs(v))}`;
const percent = (share: number): string => `${decimal.format(Math.round(share * 1000) / 10)}%`;
const monthOfKey = (key: string): number => Number(key.slice(5, 7));
const delta = (c: Readonly<{ total: number; prev: number | null }>): number => c.total - (c.prev ?? 0);

/** «+79%» / «−13%» against a base; '' without one. */
export function pctText(now: number, was: number | null): string {
  if (was === null || was <= 0) return '';
  const p = Math.abs(Math.round(((now - was) / was) * 100));
  return `${now >= was ? '+' : '−'}${p}%`;
}

/** A month: its short name, with the year on January and on the first column; a day: its number. */
export function bucketLabel(key: string, unit: 'day' | 'month', index: number): string {
  if (unit === 'day') return String(Number(key.slice(8, 10)));
  const m = monthOfKey(key);
  return m === 1 || index === 0 ? `${monthShortName(m)} ’${key.slice(2, 4)}` : monthShortName(m);
}

/** A bucket in full for tooltips and screen readers: «Октябрь 2025» / «5 окт». */
export function bucketTitle(key: string, unit: 'day' | 'month'): string {
  return unit === 'day' ? dayMonth(key) : `${monthName(monthOfKey(key))} ${key.slice(0, 4)}`;
}

/** The comparison period in words: one month in full («август 2026»), months short («окт 2024 – сен 2025»). */
export function comparedText(c: Readonly<{ from: string; to: string }>): string {
  const from = c.from.slice(0, 7);
  const to = c.to.slice(0, 7);
  const short = (ym: string) => `${monthShortName(monthOfKey(ym))} ${ym.slice(0, 4)}`;
  return from === to ? bucketTitle(from, 'month').toLowerCase() : `${short(from)} – ${short(to)}`;
}

/** Every category with spending, by the period's ranking: one colour per category on every view (past the rank colours, the «other» one). */
export function categoryRows(cats: readonly AnalyticsCategory[]): CategoryRow[] {
  return cats.filter((c) => c.total > 0).map((c, i) => ({
    key: c.categoryId ?? c.category,
    name: categoryName(c),
    color: categoryColor(i),
    net: c.net,
    total: c.total,
    prev: c.prev,
  }));
}

/** Calendar weeks Monday to Sunday of consecutive dates, labelled by their first and last day numbers. */
export function weekGroups(days: readonly string[]): Array<{ label: string; idx: number[] }> {
  const out: Array<{ label: string; idx: number[] }> = [];
  days.forEach((d, i) => {
    const monday = new Date(`${d}T00:00:00Z`).getUTCDay() === 1;
    if (i === 0 || monday) out.push({ label: '', idx: [] });
    out[out.length - 1]?.idx.push(i);
  });
  return out.map((w) => {
    const a = Number(days[w.idx[0] ?? 0]?.slice(8, 10));
    const b = Number(days[w.idx[w.idx.length - 1] ?? 0]?.slice(8, 10));
    return { label: a === b ? String(a) : `${a}–${b}`, idx: w.idx };
  });
}

const daysInMonth = (ym: string): number => new Date(Date.UTC(Number(ym.slice(0, 4)), monthOfKey(ym), 0)).getUTCDate();

/** The heatmap's columns: the months of a range; the weeks of one month. A week with a running or missing day runs. */
export function columns(v: Readonly<AnalyticsOverview>): Column[] {
  if (v.unit === 'month') {
    return v.buckets.map((b, i) => ({ label: bucketLabel(b.key, 'month', i), idx: [i], days: daysInMonth(b.key), state: b.state }));
  }
  return weekGroups(v.buckets.map((b) => b.key)).map((w) => {
    const states = w.idx.map((i) => v.buckets[i]?.state ?? 'none');
    const shown = states.filter((s) => s !== 'none').length;
    const running = states.includes('running') || shown < w.idx.length;
    return { label: w.label, idx: w.idx, days: shown, state: shown === 0 ? 'none' : running ? 'running' : 'full' };
  });
}

/** Minor units → thousands with one decimal under 10 («4,5», «18»). */
function thousands(minor: number): string {
  const v = minor / 100_000;
  return v < 10 ? decimal.format(Math.round(v * 10) / 10).replace(/,0$/, '') : String(Math.round(v));
}

/**
 * Cells against the row's usual level — its mean per day over the full columns, so a short week is not «low» for being
 * short. Within ±HEAT_EVEN neutral; warmer above, cooler below. A running column is outlined and stays out of the mean.
 */
export function heatRows(rows: readonly CategoryRow[], cols: readonly Column[], fmt: MoneyFormat): HeatRow[] {
  return rows.map((r) => {
    const values = cols.map((c) => fmt.convert(sum(c.idx.map((i) => r.net[i] ?? 0))));
    const full = cols.flatMap((c, j) => (c.state === 'full' && c.days > 0 ? [{ c, v: values[j] ?? 0 }] : []));
    const perDay = full.length ? sum(full.map((x) => x.v)) / sum(full.map((x) => x.c.days)) : 0;
    const perCol = full.length ? sum(full.map((x) => x.v)) / full.length : 0;
    return {
      key: r.key,
      name: r.name,
      color: r.color,
      avg: thousands(perCol),
      cells: cols.map((c, j) => {
        const v = values[j] ?? 0;
        const ratio = perDay > 0 && c.days > 0 ? v / c.days / perDay : 1;
        let background = 'var(--surface-sunken)';
        if (c.state === 'none') background = 'transparent';
        else if (ratio > 1 + HEAT_EVEN) background = `color-mix(in oklch, var(--heat-hot) ${Math.round(Math.min(70, 18 + (ratio - 1) * 55))}%, var(--surface))`;
        else if (ratio < 1 - HEAT_EVEN) background = `color-mix(in oklch, var(--heat-cold) ${Math.round(Math.min(60, 15 + (1 - ratio) * 60))}%, var(--surface))`;
        return {
          text: c.state === 'none' ? '' : v === 0 ? '—' : thousands(v),
          title: `${r.name}, ${c.label}: ${fmt.money(sum(c.idx.map((i) => r.net[i] ?? 0)))}`,
          background,
          strong: c.state !== 'none' && ratio > 1.4,
          running: c.state === 'running',
        };
      }),
    };
  });
}

/** The flow chart said in text (the canvas is aria-hidden): one line per bucket with data. */
export function flowList(v: Readonly<AnalyticsOverview>, fmt: MoneyFormat): Array<{ key: string; text: string }> {
  return v.buckets.flatMap((b, i) =>
    b.state === 'none'
      ? []
      : [{ key: b.key, text: t('analytics.flow.row', { when: bucketTitle(b.key, v.unit), income: fmt.money(v.income[i] ?? 0), spending: fmt.money(v.spending[i] ?? 0) }) }],
  );
}

/** Income, spending, what is left and the savings rate, each against the comparison period. */
export function kpiView(v: Readonly<AnalyticsOverview>, fmt: MoneyFormat): KpiView[] {
  const { income, spending, prev } = v.totals;
  const left = income - spending;
  const rate = income > 0 ? left / income : null;
  const prevRate = prev && prev.income > 0 ? (prev.income - prev.spending) / prev.income : null;
  const vs = (now: number, was: number | undefined) => {
    const p = pctText(now, was ?? null);
    return p ? t('analytics.kpi.vsPrev', { change: p }) : '';
  };
  const shown = v.buckets.filter((b) => b.state !== 'none').length || 1;
  const perKey = v.unit === 'day' ? 'analytics.kpi.perDay' : 'analytics.kpi.perMonth';
  return [
    { key: 'income', label: t('analytics.kpi.income'), value: fmt.money(income), note: vs(income, prev?.income), tone: prev && income > prev.income ? 'good' : 'neutral' },
    { key: 'spending', label: t('analytics.kpi.spending'), value: fmt.money(spending), note: vs(spending, prev?.spending), tone: prev && spending > prev.spending ? 'bad' : 'neutral' },
    { key: 'left', label: t('analytics.kpi.left'), value: signed(fmt, left).replace(/^\+/, ''), note: t(perKey, { amount: fmt.money(Math.round(left / shown)) }), tone: left < 0 ? 'bad' : 'neutral' },
    {
      key: 'rate',
      label: t('analytics.kpi.rate'),
      value: rate === null ? '—' : percent(rate),
      note: prevRate === null ? '' : t('analytics.kpi.wasRate', { rate: percent(prevRate) }),
      tone: rate !== null && prevRate !== null ? (rate < prevRate ? 'bad' : 'good') : 'neutral',
    },
  ];
}

/** Where a category spent most: «пик — июнь» / «пик — 14 окт». */
function peakText(v: Readonly<AnalyticsOverview>, net: readonly number[]): string {
  const top = Math.max(...net);
  if (top <= 0) return '';
  const key = v.buckets[net.indexOf(top)]?.key ?? '';
  const when = v.unit === 'month' ? monthName(monthOfKey(key)).toLowerCase() : dayMonth(key);
  return t('analytics.changes.peak', { when });
}

/** The 4 largest increases, then the largest decrease (else the 5th increase). Empty without a comparison. */
export function changesView(v: Readonly<AnalyticsOverview>, fmt: MoneyFormat): ChangeRow[] {
  if (!v.compare) return [];
  const up = v.categories.filter((c) => delta(c) > 0).sort((a, b) => delta(b) - delta(a));
  const down = v.categories.filter((c) => delta(c) < 0).sort((a, b) => delta(a) - delta(b));
  const first = down[0];
  const picked = first ? [...up.slice(0, 4), first] : up.slice(0, 5);
  return picked.map((c) => ({
    key: c.categoryId ?? c.category,
    name: categoryName(c),
    delta: signed(fmt, delta(c)),
    pct: pctText(c.total, c.prev),
    why: peakText(v, c.net),
    up: delta(c) > 0,
  }));
}

/** Every category against the comparison period, sorted by the change; the bar's left edge and width in % of the box. */
export function compareRows(v: Readonly<AnalyticsOverview>, fmt: MoneyFormat): CompareRow[] {
  if (!v.compare) return [];
  const rows = [...v.categories].sort((a, b) => delta(b) - delta(a));
  const max = Math.max(1, ...rows.map((c) => Math.abs(delta(c))));
  return rows.map((c) => {
    const d = delta(c);
    const width = (Math.abs(d) / max) * 50;
    const p = pctText(c.total, c.prev);
    return {
      key: c.categoryId ?? c.category,
      name: categoryName(c),
      up: d >= 0,
      left: d >= 0 ? 50 : 50 - width,
      width,
      delta: p ? `${signed(fmt, d)} · ${p}` : signed(fmt, d),
      span: t('analytics.views.was', { was: fmt.money(c.prev ?? 0), now: fmt.money(c.total) }),
    };
  });
}

/** The cards of «Small charts»: total, average per shown bucket, the change chip. */
export function miniCards(v: Readonly<AnalyticsOverview>, rows: readonly CategoryRow[], fmt: MoneyFormat): MiniCard[] {
  const shown = v.buckets.filter((b) => b.state !== 'none').length || 1;
  const perKey = v.unit === 'day' ? 'analytics.views.perDay' : 'analytics.views.perMonth';
  return rows.map((r) => ({
    key: r.key,
    name: r.name,
    color: r.color,
    total: fmt.money(r.total),
    avg: t(perKey, { amount: fmt.money(Math.round(r.total / shown)) }),
    chip: pctText(r.total, r.prev),
    up: r.prev === null || r.prev <= 0 ? null : r.total >= r.prev,
  }));
}

/** The area between two lines over x = 0…n−1 as polygons, split exactly where they cross; positive — `a` above `b`. */
export function gapPolygons(a: ReadonlyArray<number | null>, b: ReadonlyArray<number | null>): GapPolygon[] {
  const out: GapPolygon[] = [];
  for (let i = 0; i < a.length - 1; i++) {
    const a0 = a[i];
    const a1 = a[i + 1];
    const b0 = b[i];
    const b1 = b[i + 1];
    if (a0 == null || a1 == null || b0 == null || b1 == null) continue;
    const d0 = a0 - b0;
    const d1 = a1 - b1;
    if (d0 >= 0 === d1 >= 0) {
      out.push({ positive: d0 + d1 >= 0, points: [[i, a0], [i + 1, a1], [i + 1, b1], [i, b0]] });
    } else {
      const x = i + d0 / (d0 - d1);
      const y = a0 + (x - i) * (a1 - a0);
      out.push({ positive: d0 >= 0, points: [[i, a0], [x, y], [i, b0]] });
      out.push({ positive: d1 >= 0, points: [[x, y], [i + 1, a1], [i + 1, b1]] });
    }
  }
  return out;
}

/** Drawn values: null where the bucket has no data; one month's days as running totals. */
export function drawn(v: Readonly<AnalyticsOverview>, values: readonly number[], running: boolean): Array<number | null> {
  let s = 0;
  return values.map((x, i) => {
    s += x;
    return v.buckets[i]?.state === 'none' ? null : running ? s : x;
  });
}

function xAxisOf(v: Readonly<AnalyticsOverview>) {
  return {
    type: 'value',
    min: 0,
    max: Math.max(1, v.buckets.length - 1),
    interval: 1,
    splitLine: { show: false },
    axisLine: { lineStyle: { color: 'var(--border)' } },
    axisTick: { show: false },
    axisLabel: {
      color: 'var(--foreground-muted)',
      fontSize: 11,
      // Days: the 1st and every 5th; months: all.
      formatter: (x: number) => {
        const b = v.buckets[x];
        if (!b || (v.unit === 'day' && x !== 0 && (x + 1) % 5 !== 0)) return '';
        return bucketLabel(b.key, v.unit, x);
      },
    },
  };
}

function yAxisOf(format: (y: number) => string) {
  return {
    type: 'value',
    splitLine: { lineStyle: { color: 'var(--border-subtle)' } },
    axisLabel: { color: 'var(--foreground-muted)', fontSize: 11, formatter: format },
  };
}

const GRID = { left: 8, right: 16, top: 16, bottom: 8, containLabel: true };

type Coord = (p: [number, number]) => [number, number];

/** The fill between income and spending: polygons drawn by a custom series, its colour resolved by VChart. */
function fill(id: string, polys: readonly GapPolygon[], color: string) {
  return {
    id,
    type: 'custom',
    silent: true,
    z: 1,
    itemStyle: { color },
    data: polys.map((_, i) => [i]),
    renderItem: (params: { dataIndex: number }, api: { coord: Coord; visual: (k: string) => string }) => ({
      type: 'polygon',
      shape: { points: (polys[params.dataIndex]?.points ?? []).map((p) => api.coord(p)) },
      style: { fill: api.visual('color'), opacity: 0.16 },
    }),
  };
}

type AxisParam = { seriesName?: string; value: [number, number | null] };

/** «Income and spending»: two lines over buckets with the area between them; one month — running totals and the usual month. */
export function flowChartOption(v: Readonly<AnalyticsOverview>, fmt: MoneyFormat): ChartOption {
  const days = v.unit === 'day';
  const income = drawn(v, v.income, days);
  const spending = drawn(v, v.spending, days);
  const polys = gapPolygons(income, spending);
  const line = (id: string, name: string, color: string, values: ReadonlyArray<number | null>, dashed = false) => ({
    id,
    name,
    type: 'line',
    z: 3,
    showSymbol: !days,
    symbolSize: 6,
    lineStyle: { color, width: dashed ? 1.5 : 2.5, type: dashed ? 'dashed' : 'solid' },
    itemStyle: { color },
    data: values.map((y, x) => [x, y]),
  });
  return {
    grid: GRID,
    xAxis: xAxisOf(v),
    yAxis: yAxisOf((y) => fmt.money(y)),
    tooltip: {
      ...CHART_TOOLTIP,
      trigger: 'axis',
      formatter: (ps: AxisParam[]) => {
        const x = ps[0]?.value[0] ?? 0;
        const head = bucketTitle(v.buckets[x]?.key ?? '', v.unit);
        return [head, ...ps.flatMap((p) => (p.seriesName && p.value[1] !== null ? [`${p.seriesName}: ${fmt.money(p.value[1])}`] : []))].join('\n');
      },
    },
    series: [
      fill('gain', polys.filter((p) => p.positive), 'var(--success)'),
      fill('loss', polys.filter((p) => !p.positive), 'var(--danger)'),
      line('income', t('analytics.flow.income'), 'var(--success)', income),
      line('spending', t('analytics.flow.spending'), 'var(--primary)', spending),
      ...(days && v.usual ? [line('usual', t('analytics.flow.usual'), 'var(--foreground-muted)', v.usual, true)] : []),
    ],
  };
}

/** «Lines»: one line per row that is on (one month — running totals); hovering a row fades the others. */
export function linesOption(
  v: Readonly<AnalyticsOverview>,
  rows: readonly CategoryRow[],
  on: ReadonlySet<string>,
  hover: string | null,
  mode: LinesMode,
  fmt: MoneyFormat,
): ChartOption {
  const days = v.unit === 'day';
  const total = drawn(v, v.spending, days);
  const share = mode === 'share';
  return {
    grid: GRID,
    xAxis: xAxisOf(v),
    yAxis: yAxisOf(share ? (y) => `${y}%` : (y) => fmt.money(y)),
    tooltip: {
      ...CHART_TOOLTIP,
      trigger: 'axis',
      formatter: (ps: AxisParam[]) => {
        const x = ps[0]?.value[0] ?? 0;
        const value = (y: number) => (share ? `${decimal.format(Math.round(y * 10) / 10)}%` : fmt.money(y));
        return [bucketTitle(v.buckets[x]?.key ?? '', v.unit), ...ps.flatMap((p) => (p.seriesName && p.value[1] !== null ? [`${p.seriesName}: ${value(p.value[1])}`] : []))].join('\n');
      },
    },
    series: rows
      .filter((r) => on.has(r.key))
      .map((r) => {
        const faded = hover !== null && hover !== r.key;
        return {
          id: r.key,
          name: r.name,
          type: 'line',
          showSymbol: false,
          emphasis: { focus: 'series' },
          lineStyle: { color: r.color, width: hover === r.key ? 3.5 : 2.25, opacity: faded ? 0.15 : 1 },
          itemStyle: { color: r.color, opacity: faded ? 0.15 : 1 },
          data: drawn(v, r.net, days).map((y, x) => {
            const all = total[x];
            return [x, y === null ? null : share ? (all ? (y / all) * 100 : 0) : y];
          }),
        };
      }),
  };
}

/** A small chart: the row's bars, the peak solid, the dashed average over the shown buckets. */
export function miniOption(v: Readonly<AnalyticsOverview>, row: Readonly<CategoryRow>, fmt: MoneyFormat): ChartOption {
  const shown = v.buckets.map((b) => b.state !== 'none');
  const peak = row.net.indexOf(Math.max(...row.net));
  const n = shown.filter(Boolean).length || 1;
  return {
    grid: { left: 0, right: 0, top: 4, bottom: 0 },
    xAxis: { type: 'category', show: false, data: v.buckets.map((b) => b.key) },
    yAxis: { type: 'value', show: false },
    tooltip: {
      ...CHART_TOOLTIP,
      trigger: 'item',
      formatter: (p: { dataIndex: number }) => `${bucketTitle(v.buckets[p.dataIndex]?.key ?? '', v.unit)}: ${fmt.money(row.net[p.dataIndex] ?? 0)}`,
    },
    series: [
      {
        type: 'bar',
        barWidth: '60%',
        data: row.net.map((y, i) => ({ value: shown[i] ? y : null, itemStyle: { color: row.color, opacity: i === peak ? 1 : 0.45, borderRadius: [2, 2, 0, 0] } })),
        markLine: {
          silent: true,
          symbol: 'none',
          label: { show: false },
          lineStyle: { color: 'var(--foreground-secondary)', type: 'dashed', width: 1 },
          data: [{ yAxis: row.total / n }],
        },
      },
    ],
  };
}
