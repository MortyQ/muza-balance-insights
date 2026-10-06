import { change, monthName, monthShortName, t } from '@/shared/lib';
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
  if (avg === null) return { bars, avg: null, caption: '' };
  const parts = [t('entities.operations.months.avg', { amount: fmt.money(avg) })];
  const c = shown === undefined || shown.value === null ? null : change(shown.value, avg);
  if (shown && c && (c.kind === 'up' || c.kind === 'down')) {
    parts.push(t(c.kind === 'up' ? 'entities.operations.months.above' : 'entities.operations.months.below', { month: monthName(monthNo(shown.month)), amount: fmt.money(c.diff) }));
  }
  return { bars, avg: max > 0 ? pct(avg, max) : null, caption: parts.join(' · ') };
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
