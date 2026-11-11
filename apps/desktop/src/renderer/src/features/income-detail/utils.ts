import type { DetailPeriod, IncomeLineView, IncomeOverview, RegularIncome, RegularIncomeSource } from '@contract/api.ts';
import { accountName, bankOf } from '@/entities/bank';
import type { MoneyFormat } from '@/entities/currency-display';
import {
  changeChip, dayMonth, monthIn, monthOf, monthsView as monthBars, nameKey, partBars, PERIOD_BLOCKS, periodTitle, pct, peopleBars, searchText, shareItems, weekdayShort, whenView as whenBars,
  type LineRowView, type MarkView, type MonthsView, type PartView, type PersonRef, type PersonView, type ShareItemView, type SortKey, type StatView, type SummaryView,
  type WhenView,
} from '@/entities/operations';
import { dayMonthName, formatMoney, monthName, t } from '@/shared/lib';
import { INCOME_COLOR, PERIOD_TEXT, TOP_SENDERS } from './constants.ts';
import type { ExpectedIncomeView, RegularHeaderView, RegularSourceView, SourceView } from './types.ts';

const received = (l: Readonly<IncomeLineView>) => l.uah;

/** Senders match regardless of case and spaces (as main groups them). */
export const senderKey = nameKey;

/** The figure's label: «Received this month», «Received that week», «Received that day». */
export const receivedLabel = (r: DetailPeriod): string => t(PERIOD_TEXT[r.kind].received);

/** The compared period in words: last month's name, or last week; for the lines and the figure. */
function prevWords(v: Readonly<IncomeOverview>): { lines: (n: number) => string; amount: (amount: string) => string } {
  if (v.range.kind === 'week') {
    return { lines: (n) => t('income.summary.linesPrevWeek', { n }), amount: (amount) => t('income.summary.vsPrevWeek', { amount }) };
  }
  const month = v.compare ? monthIn(v.compare.from) : '';
  return { lines: (n) => t('income.summary.linesPrev', { month, n }), amount: (amount) => t('income.summary.vsPrev', { month, amount }) };
}

/** The header and the figures of the period. `who` — «Whole family» or a person ('' — the only one). */
export function summaryView(v: Readonly<IncomeOverview>, who: string, fmt: MoneyFormat): SummaryView {
  const s = v.summary;
  const prev = prevWords(v);
  const largest = s.largest === null ? undefined : v.lines.find((l) => l.key === s.largest);
  const stats: StatView[] = [
    { label: t('income.summary.lines'), value: String(s.lines), note: s.prev ? prev.lines(s.prev.lines) : '' },
    {
      label: t('income.summary.avg'),
      value: s.lines > 0 ? fmt.money(Math.round(s.total / s.lines)) : '—',
      also: s.lines > 0 ? fmt.approx(Math.round(s.total / s.lines)) : [],
      note: s.median === null ? '' : t('income.summary.median', { amount: fmt.money(s.median) }),
    },
  ];
  if (PERIOD_BLOCKS[v.range.kind].perDay) {
    stats.push({
      label: t('income.summary.perDay'),
      value: s.perDay === null ? '—' : fmt.money(s.perDay),
      also: s.perDay === null ? [] : fmt.approx(s.perDay),
      note: t('income.summary.activeDays', { n: s.activeDays, days: v.period.days }),
    });
  }
  stats.push({
    label: t('income.summary.spent'),
    value: fmt.money(s.spending),
    also: fmt.approx(s.spending),
    note: s.total > 0 ? t('income.summary.spentShare', { pct: Math.round((s.spending / s.total) * 100) }) : '',
  });
  if (largest && largest.uah !== null) {
    stats.push({
      label: t('income.summary.largest'),
      value: fmt.money(largest.uah),
      also: fmt.approx(largest.uah),
      note: t('income.summary.largestWhere', { sender: largest.sender || t('entities.operations.noDescription'), date: dayMonth(largest.date), time: largest.time }),
    });
  }
  return {
    name: t('income.title'),
    icon: 'lucide:wallet',
    color: INCOME_COLOR,
    subtitle: [periodTitle(v.range), who].filter(Boolean).join(' · '),
    amount: fmt.money(s.total),
    conv: fmt.approxInline(s.total),
    chip: changeChip(s.total, s.prev?.total ?? null, v.compare, fmt, v.range.kind === 'week' ? 'week' : 'month'),
    prev: s.prev ? prev.amount(fmt.money(s.prev.total)) : '',
    note: '',
    stats,
  };
}

/** «No income in September.» (that week, that day); '' — there are lines. */
export function noneText(v: Readonly<IncomeOverview>): string {
  if (v.lines.length > 0) return '';
  return v.range.kind === 'month' ? t('income.none', { month: monthIn(v.range.month) }) : t(PERIOD_TEXT[v.range.kind].none);
}

/** The 12 months (a month only, else null): bars on one scale, the average of the finished months with data, how the picked month stands against it. */
export function monthsView(v: Readonly<IncomeOverview>, fmt: MoneyFormat): MonthsView | null {
  if (v.range.kind !== 'month') return null;
  return monthBars(v.months.map((m) => ({ month: m.month, value: m.total })), v.range.month, v.thisMonth, fmt);
}

/** «Who received» (the family view): each person with income, on the largest one's scale. */
export function peopleView(v: Readonly<IncomeOverview>, people: ReadonlyArray<PersonRef>, fmt: MoneyFormat): PersonView[] {
  return peopleBars(v.people.map((p) => ({ participantId: p.participantId, value: p.total, count: p.lines })), people, fmt);
}

/** «By bank»: each bank with income in the view, on the largest one's scale, in the bank's colour (spec desktop-bank-breakdown). */
const bankLook = (provider: string) => {
  const bank = bankOf(provider);
  return { name: bank.name, color: bank.color };
};

export function banksView(v: Readonly<IncomeOverview>, fmt: MoneyFormat): PartView[] {
  return partBars(v.banks.map((b) => ({ key: b.provider, ...bankLook(b.provider), value: b.total, count: b.lines })), fmt);
}

/** «Where from»: each source with income, its share of the period. */
export function sourcesView(v: Readonly<IncomeOverview>, fmt: MoneyFormat): SourceView[] {
  const max = Math.max(0, ...v.sources.map((s) => s.total));
  return v.sources
    .filter((s) => s.total > 0)
    .map((s) => ({
      source: s.source,
      label: t(`income.sources.source.${s.source}`),
      amount: fmt.money(s.total),
      also: fmt.approx(s.total),
      caption: [t('home.spending.ops', s.lines), `${v.summary.total > 0 ? Math.round((s.total / v.summary.total) * 100) : 0}%`].join(' · '),
      width: pct(s.total, max),
    }));
}

/** «From»: the top senders on the largest one's scale; `picked` — the list's filter. */
export function sendersView(v: Readonly<IncomeOverview>, picked: string | null, fmt: MoneyFormat): ShareItemView[] {
  return shareItems(v.senders.map((s) => ({ name: s.name, value: s.total, count: s.lines })), v.summary.total, picked, TOP_SENDERS, fmt);
}

/** «N more senders»; '' — none. */
export function moreSendersText(v: Readonly<IncomeOverview>): string {
  const rest = v.senders.length - TOP_SENDERS;
  return rest > 0 ? t('income.from.more', rest) : '';
}

/**
 * «When» of the given lines (all of the period, or one sender's): the charts the period has (PERIOD_BLOCKS); `sender` —
 * the filter's name for the title ('' — none).
 */
export function whenView(lines: ReadonlyArray<IncomeLineView>, v: Readonly<Pick<IncomeOverview, 'range' | 'period'>>, sender: string, fmt: MoneyFormat): WhenView {
  return whenBars(lines, monthOf(v.range), v.period.days, sender, fmt, received, PERIOD_BLOCKS[v.range.kind]);
}

function marksOf(l: Readonly<IncomeLineView>): MarkView[] {
  const marks: MarkView[] = [];
  if (l.pending) marks.push({ text: t('entities.operations.mark.pending'), tone: 'warning', hint: t('entities.operations.mark.pendingHint') });
  if (l.operation) marks.push({ text: t('entities.operations.mark.foreign'), tone: 'accent' });
  if (l.uah === null) marks.push({ text: t('entities.operations.mark.noRate'), tone: 'warning' });
  return marks;
}

/** The list: the sender filter, the search and the order applied (main sends the lines newest first). */
export function lineRows(
  lines: ReadonlyArray<IncomeLineView>,
  o: { sender: string | null; query: string; sort: SortKey },
  people: ReadonlyArray<PersonRef>,
  fmt: MoneyFormat,
): { rows: LineRowView[]; shown: IncomeLineView[] } {
  const needle = nameKey(o.query);
  const amountOf = (l: Readonly<IncomeLineView>) => (l.uah === null ? formatMoney(l.amount, l.currency) : fmt.money(l.uah));
  const shown = lines.filter(
    (l) => (o.sender === null || nameKey(l.sender) === o.sender) && (needle === '' || searchText(l.sender, l.comment, amountOf(l)).includes(needle)),
  );
  if (o.sort === 'amount') shown.sort((a, b) => (b.uah ?? b.amount) - (a.uah ?? a.amount));
  const rows = shown.map((l): LineRowView => {
    const who = people.find((p) => p.id === l.participantId);
    return {
      key: l.key,
      date: dayMonth(l.date),
      time: `${weekdayShort(l.weekday)}, ${l.time}`,
      merchant: l.sender || t('entities.operations.noDescription'),
      comment: l.comment ?? '',
      person: who?.name ?? '',
      personColor: who?.color ?? 'var(--border-strong)',
      account: accountName(l.account),
      marks: marksOf(l),
      amount: `+${amountOf(l)}`,
      incoming: true,
      also: l.uah === null ? [] : fmt.alsoFor(l.uah, [...(l.operation ? [l.operation] : []), { amount: l.amount, currency: l.currency }]),
      original: l.operation && !fmt.shows(l.operation.currency) ? formatMoney(Math.abs(l.operation.amount), l.operation.currency) : '',
    };
  });
  return { rows, shown };
}

/** The list's total: the month's own figure while nothing filters it (no rounding drift), else the shown lines'. */
export function listTotal(v: Readonly<IncomeOverview>, shown: ReadonlyArray<IncomeLineView>, filtered: boolean, fmt: MoneyFormat): string {
  const k = filtered ? shown.reduce((s, l) => s + (l.uah ?? 0), 0) : v.summary.total;
  return withAlso(fmt, k);
}

/** A figure in the main currency followed by its «Show also» currencies on the same line: «69 € · ≈ 3 541 ₴». */
function withAlso(fmt: MoneyFormat, kopecks: number): string {
  const also = fmt.approxInline(kopecks);
  return also ? `${fmt.money(kopecks)} · ${also}` : fmt.money(kopecks);
}

/** «Regular income: 40 000 ₴ a month», «≈ 30% of it goes to regular payments»; none found — the empty words. */
export function regularHeaderView(r: Readonly<RegularIncome>, fmt: MoneyFormat): RegularHeaderView {
  if (r.sources.length === 0) return { title: t('income.regular.none'), also: '', covered: '' };
  return {
    title: t('income.regular.monthly', { amount: fmt.money(r.monthly) }),
    also: fmt.approxInline(r.monthly),
    covered: r.coveredByPayments === null ? '' : t('income.regular.covered', { pct: r.coveredByPayments }),
  };
}

/** A source's typical amount: hryvnia by today's rate with the «Show also» lines, else its own currency. */
function sourceAmount(s: Readonly<RegularIncomeSource>, fmt: MoneyFormat): { amount: string; also: string[] } {
  if (s.uah === null) return { amount: formatMoney(s.amount, s.currency), also: [] };
  return { amount: fmt.money(s.uah), also: fmt.alsoFor(s.uah, [{ currency: s.currency, amount: s.amount }]) };
}

/** On time, late by N days (the expected date has passed), or the amount changed by N% (signed). */
export function regularMark(s: Readonly<Pick<RegularIncomeSource, 'late' | 'change'>>): RegularSourceView['mark'] {
  if (s.late !== null) return { text: t('income.regular.late', s.late), tone: 'late' };
  if (s.change !== null) return { text: t('income.regular.changed', { pct: `${s.change > 0 ? '+' : '−'}${Math.abs(s.change)}` }), tone: 'changed' };
  return { text: t('income.regular.onTime'), tone: 'ok' };
}

/** «Regular sources»: each active source with its typical amount, how often, the last and the next date, its mark. */
export function regularSourcesView(r: Readonly<RegularIncome>, fmt: MoneyFormat): RegularSourceView[] {
  const year = Number(r.today.slice(0, 4));
  return r.sources.map((s) => ({
    key: s.key,
    name: s.name || t('entities.operations.noDescription'),
    ...sourceAmount(s, fmt),
    often: t('income.regular.often'),
    last: dayMonthName(s.last, year),
    next: dayMonthName(s.next, year),
    mark: regularMark(s),
  }));
}

/** «Expected in the next 30 days»: the sources due, soonest first. */
export function expectedView(r: Readonly<RegularIncome>, fmt: MoneyFormat): ExpectedIncomeView[] {
  const year = Number(r.today.slice(0, 4));
  return r.expected.map((s) => ({ key: s.key, name: s.name || t('entities.operations.noDescription'), ...sourceAmount(s, fmt), date: dayMonthName(s.next, year) }));
}
