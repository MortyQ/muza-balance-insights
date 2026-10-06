import { change, monthName, monthShortName, t } from '@/shared/lib';
import type { ChangeChipModel, ChartOption } from '@/shared/ui';
import { MIN_BAR } from './constants.ts';
import type { BarView, DayPartView, Money, MonthsView, PersonRef, PersonView, ShareItemView, WhenLine, WhenView } from './types.ts';

type MonthNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;
type DayPart = 0 | 1 | 2 | 3;

// 'YYYY-MM…' holds a month 01–12 and the contract's weekday is 1–7 (main's isoWeekday): the casts only name that.
export const monthNo = (date: string): MonthNumber => Number(date.slice(5, 7)) as MonthNumber;
/** «in September» (`common.monthIn.*`). */
export const monthIn = (date: string): string => t(`common.monthIn.${monthNo(date)}`);
export const weekdayShort = (n: number): string => t(`common.weekdayShort.${n as Weekday}`);
const partName = (i: number) => t(`entities.operations.when.part.${i as DayPart}`);
/** «8 сен». */
export const dayMonth = (date: string): string => `${Number(date.slice(8, 10))} ${monthShortName(monthNo(date))}`;
export const pct = (value: number, max: number): number => (max > 0 ? Math.round((value / max) * 1000) / 10 : 0);
/** A bar with a value never vanishes; one without stays flat. */
const barHeight = (value: number, max: number) => (value > 0 && max > 0 ? Math.max(MIN_BAR, pct(value, max)) : 0);

/** Names (merchants, senders) match regardless of case and spaces (as main groups them). */
export const nameKey = (s: string): string => s.toLocaleLowerCase('uk').replace(/\s+/g, ' ').trim();

export const initial = (name: string): string => name.slice(0, 1).toLocaleUpperCase('uk');

/** The change against the compared period, the spending block's words (`home.spending.change.*`). */
export function changeChip(value: number, prev: number | null, compare: Readonly<{ from: string; partial: boolean }> | null): ChangeChipModel | null {
  const c = change(value, prev);
  if (!c || !compare) return null;
  const month = monthIn(compare.from);
  if (c.kind === 'new') return { text: t('home.spending.change.new'), tone: 'neutral', arrow: null, sr: '' };
  if (c.kind === 'same') return { text: t('home.spending.change.same', { month }), tone: 'neutral', arrow: null, sr: '' };
  const up = c.kind === 'up';
  const key = up
    ? (compare.partial ? 'home.spending.change.morePartial' : 'home.spending.change.more')
    : (compare.partial ? 'home.spending.change.lessPartial' : 'home.spending.change.less');
  return { text: t(key, { pct: c.pct, month }), tone: up ? 'up' : 'down', arrow: up ? 'up' : 'down', sr: '' };
}

/**
 * The 12 months: bars on one scale, the average of the finished months with data (the running one, `thisMonth`, is
 * left out), how the picked month stands against it. `value` null — before the data starts.
 */
export function monthsView(
  months: ReadonlyArray<{ month: string; value: number | null }>,
  picked: string,
  thisMonth: string,
  fmt: Money,
): MonthsView {
  const max = Math.max(0, ...months.map((m) => m.value ?? 0));
  const done = months.filter((m) => m.value !== null && m.month !== thisMonth).map((m) => Math.max(0, m.value ?? 0));
  const avg = done.length > 0 ? Math.round(done.reduce((a, b) => a + b, 0) / done.length) : null;
  const shown = months.find((m) => m.month === picked);
  const bars = months.map((m): BarView => {
    const amount = m.value === null ? t('entities.operations.months.noData') : fmt.money(m.value);
    return {
      key: m.month,
      label: monthShortName(monthNo(m.month)),
      height: m.value === null ? 0 : barHeight(m.value, max),
      strong: m.month === picked,
      title: `${monthName(monthNo(m.month))} ${m.month.slice(0, 4)} — ${m.month === thisMonth ? t('entities.operations.months.soFar', { amount }) : amount}`,
    };
  });
  if (avg === null) return { bars, avg: null, avgLabel: '', caption: '' };
  const parts = [t('entities.operations.months.avg', { amount: fmt.money(avg) })];
  const c = shown === undefined || shown.value === null ? null : change(shown.value, avg);
  if (shown && c && (c.kind === 'up' || c.kind === 'down')) {
    parts.push(t(c.kind === 'up' ? 'entities.operations.months.above' : 'entities.operations.months.below', { month: monthName(monthNo(shown.month)), amount: fmt.money(c.diff) }));
  }
  return { bars, avg: max > 0 ? pct(avg, max) : null, avgLabel: t('entities.operations.avg', { amount: fmt.money(avg) }), caption: parts.join(' · ') };
}

/** «N ops · avg X», the caption of a person or a name. */
function countCaption(value: number, count: number, fmt: Money): string {
  return [t('home.spending.opsShort', { n: count }), count > 0 ? t('entities.operations.avg', { amount: fmt.money(Math.round(value / count)) }) : '']
    .filter(Boolean)
    .join(' · ');
}

/** Each person with a value, on the largest one's scale. */
export function peopleBars(
  parts: ReadonlyArray<{ participantId: number; value: number; count: number }>,
  people: ReadonlyArray<PersonRef>,
  fmt: Money,
): PersonView[] {
  const max = Math.max(0, ...parts.map((p) => p.value));
  return parts
    .filter((p) => p.value > 0)
    .map((p) => {
      const who = people.find((x) => x.id === p.participantId) ?? { id: p.participantId, name: '?', color: 'var(--border-strong)' };
      return {
        participantId: p.participantId,
        name: who.name,
        initial: initial(who.name),
        color: who.color,
        amount: fmt.money(p.value),
        caption: countCaption(p.value, p.count, fmt),
        width: pct(p.value, max),
      };
    })
    .sort((a, b) => b.width - a.width);
}

/** The top `top` names on the largest one's scale, with their share of `total`; `picked` — the list's filter. */
export function shareItems(
  items: ReadonlyArray<{ name: string; value: number; count: number }>,
  total: number,
  picked: string | null,
  top: number,
  fmt: Money,
): ShareItemView[] {
  const shown = items.slice(0, top);
  const max = Math.max(0, ...shown.map((m) => m.value));
  return shown.map((m) => {
    const key = nameKey(m.name);
    const share = total > 0 ? Math.round((m.value / total) * 100) : 0;
    return {
      key,
      name: m.name || t('entities.operations.noDescription'),
      amount: fmt.money(m.value),
      caption: [countCaption(m.value, m.count, fmt), `${share}%`].join(' · '),
      width: pct(m.value, max),
      pressed: picked === key,
    };
  });
}

/** 0 morning 6–12, 1 day 12–18, 2 evening 18–23, 3 night 23–6. */
export function dayPart(hour: number): number {
  if (hour >= 6 && hour < 12) return 0;
  if (hour >= 12 && hour < 18) return 1;
  if (hour >= 18 && hour < 23) return 2;
  return 3;
}

/** `value` (hryvnia kopecks; null — the line counts nowhere) by ISO weekday, part of the day and day of the month. */
export function whenTotals<L extends WhenLine>(
  lines: ReadonlyArray<L>,
  daysInMonth: number,
  value: (l: L) => number | null,
): { weekdays: number[]; dayParts: number[]; days: number[] } {
  const weekdays = Array<number>(7).fill(0);
  const dayParts = Array<number>(4).fill(0);
  const days = Array<number>(daysInMonth).fill(0);
  for (const l of lines) {
    const v = value(l);
    if (v === null) continue;
    weekdays[l.weekday - 1] = (weekdays[l.weekday - 1] ?? 0) + v;
    const p = dayPart(Number(l.time.slice(0, 2)));
    dayParts[p] = (dayParts[p] ?? 0) + v;
    const day = Number(l.date.slice(8, 10));
    if (day >= 1 && day <= daysInMonth) days[day - 1] = (days[day - 1] ?? 0) + v;
  }
  return { weekdays, dayParts, days };
}

/**
 * «When» of the given lines (all of the month, or one name's): weekdays, parts of the day, days of the month, and the
 * peak in words; `name` — the filter's name for the title ('' — none).
 */
export function whenView<L extends WhenLine>(
  lines: ReadonlyArray<L>,
  month: string,
  daysInMonth: number,
  name: string,
  fmt: Money,
  value: (l: L) => number | null,
): WhenView {
  const w = whenTotals(lines, daysInMonth, value);
  const wMax = Math.max(0, ...w.weekdays);
  const pMax = Math.max(0, ...w.dayParts);
  const dMax = Math.max(0, ...w.days);
  const peakDay = w.weekdays.indexOf(wMax);
  const peakPart = w.dayParts.indexOf(pMax);
  return {
    title: name ? t('entities.operations.when.titleFor', { name }) : t('entities.operations.when.title'),
    weekdays: w.weekdays.map((n, i) => ({
      key: String(i),
      label: weekdayShort(i + 1),
      height: barHeight(n, wMax),
      strong: wMax > 0 && n === wMax,
      title: `${weekdayShort(i + 1)} — ${fmt.money(n)}`,
    })),
    dayParts: w.dayParts.map((n, i): DayPartView => ({ label: partName(i), amount: fmt.money(n), width: pct(Math.max(0, n), pMax), strong: pMax > 0 && n === pMax })),
    days: w.days.map((n, i) => ({
      key: String(i + 1),
      label: String(i + 1),
      height: barHeight(n, dMax),
      strong: n > 0,
      title: t('entities.operations.when.dayTitle', { day: i + 1, month: monthShortName(monthNo(month)), amount: fmt.money(n) }),
    })),
    peak: wMax > 0 && pMax > 0 ? t('entities.operations.when.peak', { weekday: weekdayShort(peakDay + 1), part: partName(peakPart) }) : '',
  };
}

/** What a search reads in a line: its text, comment and amounts as shown and as bare digits. */
export function searchText(text: string, comment: string | null, amount: string): string {
  return nameKey([text, comment ?? '', amount, amount.replace(/\D/g, '')].join(' '));
}

/** A bar that is not the highlighted one: the colour mixed into the surface. */
export const SOFT_BAR = 'color-mix(in oklch, var(--cat) 45%, var(--surface))';

/**
 * Where the tooltip goes: beside the pointer (right, or left when it does not fit), never under it — a canvas tooltip
 * catches the pointer itself, and one under it would take the hover from the bar and blink.
 */
export function besidePointer(point: [number, number], size: { contentSize: [number, number]; viewSize: [number, number] }): [number, number] {
  const GAP = 14;
  const [x, y] = point;
  const [w, h] = size.contentSize;
  const [vw, vh] = size.viewSize;
  const left = x + GAP + w > vw ? x - GAP - w : x + GAP;
  return [left, Math.max(0, Math.min(y - h / 2, vh - h))];
}

/** The tooltip every chart shows: drawn on the canvas (no HTML), in the card's colours. */
export const CHART_TOOLTIP = {
  renderMode: 'richText',
  position: (point: [number, number], _params: unknown, _dom: unknown, _rect: unknown, size: { contentSize: [number, number]; viewSize: [number, number] }) =>
    besidePointer(point, size),
  backgroundColor: 'var(--surface-raised)',
  borderColor: 'var(--border-subtle)',
  textStyle: { color: 'var(--foreground)', fontSize: 12 },
};

/** «Last 12 months» for VChart: the bars' heights (% of the chart), the strong one in the colour, the dashed average. */
export function monthsChartOption(m: Readonly<MonthsView>): ChartOption {
  return {
    grid: { left: 0, right: 0, top: 6, bottom: 22 },
    xAxis: {
      type: 'category',
      data: m.bars.map((b) => b.label),
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        interval: 0,
        fontSize: 11,
        color: 'var(--foreground-muted)',
        formatter: (label: string, i: number) => (m.bars[i]?.strong ? `{strong|${label}}` : label),
        rich: { strong: { fontSize: 11, fontWeight: 'bold', color: 'var(--foreground)' } },
      },
    },
    yAxis: { type: 'value', min: 0, max: 100, show: false },
    tooltip: { ...CHART_TOOLTIP, trigger: 'item', formatter: (p: { dataIndex: number }) => m.bars[p.dataIndex]?.title ?? '' },
    series: [
      {
        type: 'bar',
        barCategoryGap: '12%',
        data: m.bars.map((b) => ({ value: b.height, itemStyle: { color: b.strong ? 'var(--cat)' : SOFT_BAR, borderRadius: [6, 6, 0, 0] } })),
        ...(m.avg === null
          ? {}
          : {
              markLine: {
                silent: true,
                symbol: 'none',
                label: {
                  show: m.avgLabel !== '',
                  position: 'insideEndTop',
                  formatter: () => m.avgLabel,
                  fontSize: 11,
                  color: 'var(--foreground-secondary)',
                  backgroundColor: 'var(--surface)',
                  padding: [1, 4],
                  borderRadius: 4,
                },
                lineStyle: { type: 'dashed', width: 1.5, color: 'var(--foreground-muted)' },
                data: [{ yAxis: m.avg }],
              },
            }),
      },
    ],
  };
}

/** A row of plain bars: no axes but the labels under it, every bar's tooltip. `label` — which labels to write. */
function barsOption(bars: ReadonlyArray<BarView>, o: { color: (b: BarView) => string; value: (b: BarView) => number; radius: number; gap: string; label: (i: number) => boolean; bottom: number }): ChartOption {
  return {
    grid: { left: 0, right: 0, top: 4, bottom: o.bottom },
    xAxis: {
      type: 'category',
      data: bars.map((b) => b.label),
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { show: o.bottom > 0, interval: (i: number) => o.label(i), fontSize: 11, color: 'var(--foreground-secondary)', hideOverlap: false },
    },
    yAxis: { type: 'value', min: 0, max: 100, show: false },
    tooltip: { ...CHART_TOOLTIP, trigger: 'item', formatter: (p: { dataIndex: number }) => bars[p.dataIndex]?.title ?? '' },
    series: [
      {
        type: 'bar',
        barCategoryGap: o.gap,
        data: bars.map((b) => ({ value: o.value(b), itemStyle: { color: o.color(b), borderRadius: [o.radius, o.radius, 0, 0] } })),
      },
    ],
  };
}

/** «By weekday» of «When»: the peak in the colour, the rest softer. */
export function weekdaysChartOption(w: Readonly<WhenView>): ChartOption {
  return barsOption(w.weekdays, { color: (b) => (b.strong ? 'var(--cat)' : SOFT_BAR), value: (b) => b.height, radius: 4, gap: '18%', label: () => true, bottom: 20 });
}

/** A day without a value still shows as a thin line (% of the chart). */
const EMPTY_DAY = 4;

/** «By day of the month» of «When»: days with a value in the colour, the others a thin line; labels under the chart. */
export function daysChartOption(w: Readonly<WhenView>): ChartOption {
  return barsOption(w.days, {
    color: (b) => (b.strong ? 'var(--cat)' : 'var(--border)'),
    value: (b) => (b.strong ? b.height : EMPTY_DAY),
    radius: 2,
    gap: '15%',
    label: (i) => i === 0 || i === 9 || i === 19 || i === w.days.length - 1,
    bottom: 18,
  });
}
