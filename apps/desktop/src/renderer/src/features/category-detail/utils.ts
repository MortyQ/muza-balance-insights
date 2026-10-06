import type { CategoryLineView, CategoryOverview } from '@contract/api.ts';
import { accountName } from '@/entities/bank';
import { CATEGORY_ICON, categoryColor, categoryName } from '@/entities/category';
import type { MoneyFormat } from '@/entities/currency-display';
import {
  changeChip, dayMonth, monthIn, monthNo, monthsView as monthBars, nameKey, peopleBars, searchText, shareItems, weekdayShort, whenView as whenBars,
  type LineRowView, type MarkView, type MonthsView, type PersonRef, type PersonView, type ShareItemView, type SortKey, type StatView, type SummaryView, type WhenView,
} from '@/entities/operations';
import { formatMoney, monthName, t } from '@/shared/lib';
import { TOP_MERCHANTS } from './constants.ts';

/** Spending of a line, positive (a refund is negative); null — no rate. */
const spent = (l: Readonly<CategoryLineView>) => (l.uah === null ? null : -l.uah);

/** Merchants match regardless of case and spaces (as main groups them). */
export const merchantKey = nameKey;

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
      note: t('category.summary.largestWhere', { merchant: largest.merchant || t('entities.operations.noDescription'), date: dayMonth(largest.date), time: largest.time }),
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
    chip: changeChip(s.net, s.prev?.net ?? null, v.compare),
    prev: s.prev ? t('category.summary.vsPrev', { month: prevMonth, amount: fmt.money(s.prev.net) }) : '',
    note: s.refunds > 0 ? t('category.summary.gross', { gross: fmt.money(s.gross), refunds: fmt.money(s.refunds) }) : '',
    stats,
  };
}

/** «No spending in this category in September.»; '' — there are lines. */
export function noneText(v: Readonly<CategoryOverview>): string {
  return v.lines.length === 0 ? t('category.none', { month: monthIn(v.month) }) : '';
}

/** The 12 months: bars on one scale, the average of the finished months with data, how the picked month stands against it. */
export function monthsView(v: Readonly<CategoryOverview>, fmt: MoneyFormat): MonthsView {
  return monthBars(v.months.map((m) => ({ month: m.month, value: m.net })), v.month, v.thisMonth, fmt);
}

/** «Who spent» (the family view): each person with spending, on the largest one's scale. */
export function peopleView(v: Readonly<CategoryOverview>, people: ReadonlyArray<PersonRef>, fmt: MoneyFormat): PersonView[] {
  return peopleBars(v.people.map((p) => ({ participantId: p.participantId, value: p.net, count: p.purchases })), people, fmt);
}

/** «Where»: the top merchants on the largest one's scale; `picked` — the list's filter. */
export function merchantsView(v: Readonly<CategoryOverview>, picked: string | null, fmt: MoneyFormat): ShareItemView[] {
  return shareItems(v.merchants.map((m) => ({ name: m.name, value: m.net, count: m.purchases })), v.summary.net, picked, TOP_MERCHANTS, fmt);
}

/** «N more places»; '' — none. */
export function moreMerchantsText(v: Readonly<CategoryOverview>): string {
  const rest = v.merchants.length - TOP_MERCHANTS;
  return rest > 0 ? t('category.where.more', rest) : '';
}

/**
 * «When» of the given lines (all of the month, or one merchant's): weekdays, parts of the day, days of the month, and
 * the peak in words; `merchant` — the filter's name for the title ('' — none).
 */
export function whenView(lines: ReadonlyArray<CategoryLineView>, v: Readonly<Pick<CategoryOverview, 'month' | 'period'>>, merchant: string, fmt: MoneyFormat): WhenView {
  return whenBars(lines, v.month, v.period.days, merchant, fmt, spent);
}

function marksOf(l: Readonly<CategoryLineView>, fmt: MoneyFormat): MarkView[] {
  const marks: MarkView[] = [];
  if (l.pending) marks.push({ text: t('entities.operations.mark.pending'), tone: 'warning' });
  if (l.refund) marks.push({ text: t('category.list.mark.refund'), tone: 'good' });
  if (l.refunded) marks.push({ text: t('category.list.mark.refunded'), tone: 'neutral' });
  if (l.commission) marks.push({ text: t('category.list.mark.fee'), tone: 'neutral' });
  if (l.operation) marks.push({ text: t('entities.operations.mark.foreign'), tone: 'accent' });
  if (l.cashback > 0) marks.push({ text: t('category.list.mark.cashback', { amount: fmt.money(l.cashback) }), tone: 'good' });
  if (l.uah === null) marks.push({ text: t('entities.operations.mark.noRate'), tone: 'warning' });
  return marks;
}

/** The list: the merchant filter, the search and the order applied (main sends the lines newest first). */
export function lineRows(
  lines: ReadonlyArray<CategoryLineView>,
  o: { merchant: string | null; query: string; sort: SortKey },
  people: ReadonlyArray<PersonRef>,
  fmt: MoneyFormat,
): { rows: LineRowView[]; shown: CategoryLineView[] } {
  const needle = merchantKey(o.query);
  const amountOf = (l: Readonly<CategoryLineView>) =>
    l.uah === null ? formatMoney(Math.abs(l.amount), l.currency) : fmt.money(Math.abs(l.uah));
  const shown = lines.filter(
    (l) => (o.merchant === null || merchantKey(l.merchant) === o.merchant) && (needle === '' || searchText(l.merchant, l.comment, amountOf(l)).includes(needle)),
  );
  if (o.sort === 'amount') shown.sort((a, b) => Math.abs(b.uah ?? b.amount) - Math.abs(a.uah ?? a.amount));
  const rows = shown.map((l): LineRowView => {
    const who = people.find((p) => p.id === l.participantId);
    return {
      key: l.key,
      date: dayMonth(l.date),
      time: `${weekdayShort(l.weekday)}, ${l.time}`,
      merchant: l.merchant || t('entities.operations.noDescription'),
      comment: l.comment ?? '',
      person: who?.name ?? '',
      personColor: who?.color ?? 'var(--border-strong)',
      account: accountName(l.account),
      marks: marksOf(l, fmt),
      amount: `${l.refund ? '+' : '−'}${amountOf(l)}`,
      incoming: l.refund,
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
