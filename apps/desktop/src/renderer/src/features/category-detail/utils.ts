import type { CategoryLineView, CategoryOverview } from '@contract/api.ts';
import { accountName } from '@/entities/bank';
import { CATEGORY_ICON, categoryColor, categoryName } from '@/entities/category';
import type { MoneyFormat } from '@/entities/currency-display';
import { change, formatMoney, monthName, monthShortName, t } from '@/shared/lib';
import type { ChangeChipModel } from '@/shared/ui';
import { MIN_BAR, TOP_MERCHANTS } from './constants.ts';
import type { BarView, DayPartView, LineRowView, MarkView, MerchantView, MonthsView, PersonView, SortKey, StatView, SummaryView, WhenView } from './types.ts';

type MonthNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;
type DayPart = 0 | 1 | 2 | 3;

// 'YYYY-MM…' holds a month 01–12 and the contract's weekday is 1–7 (main's isoWeekday): the casts only name that.
const monthNo = (date: string) => Number(date.slice(5, 7)) as MonthNumber;
const monthIn = (date: string) => t(`common.monthIn.${monthNo(date)}`);
const weekdayShort = (n: number) => t(`common.weekdayShort.${n as Weekday}`);
const partName = (i: number) => t(`category.when.part.${i as DayPart}`);
/** «8 сен». */
const dayMonth = (date: string) => `${Number(date.slice(8, 10))} ${monthShortName(monthNo(date))}`;
const pct = (value: number, max: number) => (max > 0 ? Math.round((value / max) * 1000) / 10 : 0);
/** A bar with a value never vanishes; one without stays flat. */
const barHeight = (value: number, max: number) => (value > 0 && max > 0 ? Math.max(MIN_BAR, pct(value, max)) : 0);

/** Merchants match regardless of case and spaces (as main groups them). */
export const merchantKey = (s: string): string => s.toLocaleLowerCase('uk').replace(/\s+/g, ' ').trim();

export const initial = (name: string): string => name.slice(0, 1).toLocaleUpperCase('uk');

/** The change against the compared period, the spending block's words (`home.spending.change.*`). */
export function summaryChip(net: number, prev: number | null, compare: CategoryOverview['compare']): ChangeChipModel | null {
  const c = change(net, prev);
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

/** The header and the figures of the month. `who` — «Whole family» or a person ('' — the only one). */
export function summaryView(v: Readonly<CategoryOverview>, who: string, scope: string, fmt: MoneyFormat): SummaryView {
  const s = v.summary;
  const prevMonth = v.compare ? monthIn(v.compare.from) : '';
  const largest = s.largest === null ? undefined : v.lines.find((l) => l.key === s.largest);
  const stats: StatView[] = [
    { label: t('category.summary.ops'), value: String(s.purchases), note: s.prev ? t('category.summary.opsPrev', { month: prevMonth, n: s.prev.purchases }) : '' },
    {
      label: t('category.summary.avg'),
      value: s.purchases > 0 ? fmt.money(Math.round(s.gross / s.purchases)) : '—',
      note: s.median === null ? '' : t('category.summary.median', { amount: fmt.money(s.median) }),
    },
    {
      label: t('category.summary.perDay'),
      value: s.perDay === null ? '—' : fmt.money(s.perDay),
      note: t('category.summary.activeDays', { n: s.activeDays, days: v.period.days }),
    },
    {
      label: t('category.summary.share'),
      value: s.share === null ? '—' : `${Math.round(s.share * 100)}%`,
      note: s.rank === null ? '' : t('category.summary.rank', { n: s.rank }),
    },
  ];
  if (largest && largest.uah !== null) {
    stats.push({
      label: t('category.summary.largest'),
      value: fmt.money(-largest.uah),
      note: t('category.summary.largestWhere', { merchant: largest.merchant || t('category.list.noDescription'), date: dayMonth(largest.date), time: largest.time }),
    });
  }
  if (s.cashback > 0) {
    stats.push({ label: t('category.summary.cashback'), value: `+${fmt.money(s.cashback)}`, note: t('category.summary.cashbackLines', s.cashbackLines), tone: 'good' });
  }
  return {
    name: categoryName(v),
    icon: CATEGORY_ICON[v.categoryId],
    color: categoryColor(s.rank === null ? null : s.rank - 1),
    subtitle: [`${monthName(monthNo(v.month))} ${v.month.slice(0, 4)}`, who, scope].filter(Boolean).join(' · '),
    amount: fmt.money(s.net),
    conv: fmt.approxInline(s.net),
    chip: summaryChip(s.net, s.prev?.net ?? null, v.compare),
    prev: s.prev ? t('category.summary.vsPrev', { month: prevMonth, amount: fmt.money(s.prev.net) }) : '',
    gross: s.refunds > 0 ? t('category.summary.gross', { gross: fmt.money(s.gross), refunds: fmt.money(s.refunds) }) : '',
    stats,
  };
}

/** «No spending in this category in September.»; '' — there are lines. */
export function noneText(v: Readonly<CategoryOverview>): string {
  return v.lines.length === 0 ? t('category.none', { month: monthIn(v.month) }) : '';
}

/** The 12 months: bars on one scale, the average of the months with data, how the shown month stands against it. */
export function monthsView(v: Readonly<CategoryOverview>, fmt: MoneyFormat): MonthsView {
  const known = v.months.filter((m) => m.net !== null).map((m) => Math.max(0, m.net ?? 0));
  const max = Math.max(0, ...known);
  const avg = known.length > 0 ? Math.round(known.reduce((a, b) => a + b, 0) / known.length) : null;
  const last = v.months.at(-1);
  const bars = v.months.map((m, i): BarView => ({
    key: m.month,
    label: monthShortName(monthNo(m.month)),
    height: m.net === null ? 0 : barHeight(m.net, max),
    strong: i === v.months.length - 1,
    title: `${monthName(monthNo(m.month))} ${m.month.slice(0, 4)} — ${m.net === null ? t('category.months.noData') : fmt.money(m.net)}`,
  }));
  if (avg === null) return { bars, avg: null, caption: '' };
  const parts = [t('category.months.avg', { amount: fmt.money(avg) })];
  const c = last === undefined || last.net === null ? null : change(last.net, avg);
  if (last && c && (c.kind === 'up' || c.kind === 'down')) {
    parts.push(t(c.kind === 'up' ? 'category.months.above' : 'category.months.below', { month: monthName(monthNo(last.month)), amount: fmt.money(c.diff) }));
  }
  return { bars, avg: max > 0 ? pct(avg, max) : null, caption: parts.join(' · ') };
}

/** «Who spent» (the family view): each person with spending, on the largest one's scale. */
export function peopleView(
  v: Readonly<CategoryOverview>,
  people: ReadonlyArray<{ id: number; name: string; color: string }>,
  fmt: MoneyFormat,
): PersonView[] {
  const max = Math.max(0, ...v.people.map((p) => p.net));
  return v.people
    .filter((p) => p.net > 0)
    .map((p) => {
      const who = people.find((x) => x.id === p.participantId) ?? { id: p.participantId, name: '?', color: 'var(--border-strong)' };
      return {
        participantId: p.participantId,
        name: who.name,
        initial: initial(who.name),
        color: who.color,
        amount: fmt.money(p.net),
        caption: [t('home.spending.opsShort', { n: p.purchases }), p.purchases > 0 ? t('category.who.avg', { amount: fmt.money(Math.round(p.net / p.purchases)) }) : '']
          .filter(Boolean)
          .join(' · '),
        width: pct(p.net, max),
      };
    })
    .sort((a, b) => b.width - a.width);
}

/** «Where»: the top merchants on the largest one's scale; `picked` — the list's filter. */
export function merchantsView(v: Readonly<CategoryOverview>, picked: string | null, fmt: MoneyFormat): MerchantView[] {
  const top = v.merchants.slice(0, TOP_MERCHANTS);
  const max = Math.max(0, ...top.map((m) => m.net));
  return top.map((m) => {
    const key = merchantKey(m.name);
    const share = v.summary.net > 0 ? Math.round((m.net / v.summary.net) * 100) : 0;
    return {
      key,
      name: m.name || t('category.list.noDescription'),
      amount: fmt.money(m.net),
      caption: [
        t('home.spending.opsShort', { n: m.purchases }),
        m.purchases > 0 ? t('category.who.avg', { amount: fmt.money(Math.round(m.net / m.purchases)) }) : '',
        `${share}%`,
      ].filter(Boolean).join(' · '),
      width: pct(m.net, max),
      pressed: picked === key,
    };
  });
}

/** «N more places»; '' — none. */
export function moreMerchantsText(v: Readonly<CategoryOverview>): string {
  const rest = v.merchants.length - TOP_MERCHANTS;
  return rest > 0 ? t('category.where.more', rest) : '';
}

/** «When»: weekdays, parts of the day, days of the month, and the peak in words. */
export function whenView(v: Readonly<CategoryOverview>, fmt: MoneyFormat): WhenView {
  const wMax = Math.max(0, ...v.weekdays);
  const pMax = Math.max(0, ...v.dayParts);
  const dMax = Math.max(0, ...v.days);
  const peakDay = v.weekdays.indexOf(wMax);
  const peakPart = v.dayParts.indexOf(pMax);
  return {
    weekdays: v.weekdays.map((n, i) => ({
      key: String(i),
      label: weekdayShort(i + 1),
      height: barHeight(n, wMax),
      strong: wMax > 0 && n === wMax,
      title: `${weekdayShort(i + 1)} — ${fmt.money(n)}`,
    })),
    dayParts: v.dayParts.map((n, i): DayPartView => ({ label: partName(i), amount: fmt.money(n), width: pct(Math.max(0, n), pMax), strong: pMax > 0 && n === pMax })),
    days: v.days.map((n, i) => ({
      key: String(i + 1),
      label: String(i + 1),
      height: barHeight(n, dMax),
      strong: n > 0,
      title: t('category.when.dayTitle', { day: i + 1, month: monthShortName(monthNo(v.month)), amount: fmt.money(n) }),
    })),
    peak: wMax > 0 && pMax > 0 ? t('category.when.peak', { weekday: weekdayShort(peakDay + 1), part: partName(peakPart) }) : '',
  };
}

function marksOf(l: Readonly<CategoryLineView>, fmt: MoneyFormat): MarkView[] {
  const marks: MarkView[] = [];
  if (l.pending) marks.push({ text: t('category.list.mark.pending'), tone: 'warning' });
  if (l.refund) marks.push({ text: t('category.list.mark.refund'), tone: 'good' });
  if (l.refunded) marks.push({ text: t('category.list.mark.refunded'), tone: 'neutral' });
  if (l.commission) marks.push({ text: t('category.list.mark.fee'), tone: 'neutral' });
  if (l.operation) marks.push({ text: t('category.list.mark.foreign'), tone: 'accent' });
  if (l.cashback > 0) marks.push({ text: t('category.list.mark.cashback', { amount: fmt.money(l.cashback) }), tone: 'good' });
  if (l.uah === null) marks.push({ text: t('category.list.mark.noRate'), tone: 'warning' });
  return marks;
}

/** What a search reads in a line: its text, comment and amounts as shown and as bare digits. */
function haystack(l: Readonly<CategoryLineView>, amount: string): string {
  const digits = amount.replace(/\D/g, '');
  return merchantKey([l.merchant, l.comment ?? '', amount, digits].join(' '));
}

/** The list: the merchant filter, the search and the order applied (main sends the lines newest first). */
export function lineRows(
  lines: ReadonlyArray<CategoryLineView>,
  o: { merchant: string | null; query: string; sort: SortKey },
  people: ReadonlyArray<{ id: number; name: string; color: string }>,
  fmt: MoneyFormat,
): { rows: LineRowView[]; shown: CategoryLineView[] } {
  const needle = merchantKey(o.query);
  const amountOf = (l: Readonly<CategoryLineView>) =>
    l.uah === null ? formatMoney(Math.abs(l.amount), l.currency) : fmt.money(Math.abs(l.uah));
  const shown = lines.filter(
    (l) => (o.merchant === null || merchantKey(l.merchant) === o.merchant) && (needle === '' || haystack(l, amountOf(l)).includes(needle)),
  );
  if (o.sort === 'amount') shown.sort((a, b) => Math.abs(b.uah ?? b.amount) - Math.abs(a.uah ?? a.amount));
  const rows = shown.map((l): LineRowView => {
    const who = people.find((p) => p.id === l.participantId);
    return {
      key: l.key,
      date: dayMonth(l.date),
      time: `${weekdayShort(l.weekday)}, ${l.time}`,
      merchant: l.merchant || t('category.list.noDescription'),
      comment: l.comment ?? '',
      person: who?.name ?? '',
      personColor: who?.color ?? 'var(--border-strong)',
      account: accountName(l.account),
      marks: marksOf(l, fmt),
      amount: `${l.refund ? '+' : '−'}${amountOf(l)}`,
      refund: l.refund,
      original: l.operation ? formatMoney(Math.abs(l.operation.amount), l.operation.currency) : '',
    };
  });
  return { rows, shown };
}

/** The list's total: the category's own figure while nothing filters it (no rounding drift), else the shown lines'. */
export function listTotal(v: Readonly<CategoryOverview>, shown: ReadonlyArray<CategoryLineView>, filtered: boolean, fmt: MoneyFormat): string {
  if (!filtered) return fmt.money(v.summary.net);
  return fmt.money(-shown.reduce((s, l) => s + (l.uah ?? 0), 0));
}
