import { currencyExponent } from '@mono/core/currency';
import type { CardTotal, FxPart, MonthOverview, PersonView } from '@contract/api.ts';
import { colorVar } from '@/entities/participant';
import { formatMoney, monthName as calendarMonthName, monthShortName, t } from '@/shared/lib';
import { CARD_STEP, CLOSE_STAGGER, OPEN_STAGGER, STACK_DEPTH, UAH, VISIBLE_CARDS } from './constants.ts';
import type { Slide } from './types.ts';

/** Where card `i` sits: in the stack (up to STACK_DEPTH peeking behind, the rest hidden) or in the row, paged by `offset`. */
export function slidePosition(i: number, open: boolean, offset: number): { x: number; y: number; z: number; opacity: number } {
  if (open) return { x: (i - offset) * CARD_STEP, y: 0, z: 20 - i, opacity: 1 };
  const depth = Math.min(i, STACK_DEPTH);
  return { x: depth * 22, y: 52 - depth * 16, z: 20 - i, opacity: i <= STACK_DEPTH ? 1 : 0 };
}

/** Transition delay of card `i` of `n`, ms: out one by one, back from the far end; paging moves all at once. */
export function slideDelay(i: number, n: number, open: boolean, paging: boolean): number {
  if (paging) return 0;
  return open ? i * OPEN_STAGGER : (n - i) * CLOSE_STAGGER;
}

export function maxOffset(n: number): number {
  return Math.max(0, n - VISIBLE_CARDS);
}

const yearSuffix = (y: number, current: number) => (y === current ? '' : ` ${y}`);

type MonthNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
/** The month after a day number: «31 July» (genitive in uk / ru). */
const monthOfDay = (m: number) => t(`home.balances.monthGen.${m as MonthNumber}`);

/** «Own money · today» / «Own money · on 31 July [2025]»; `label` replaces «Own money» on an account's card. */
export function balanceCaption(balanceAt: 'now' | string, currentYear: number, label = t('home.balances.ownFunds')): string {
  if (balanceAt === 'now') return t('home.balances.captionToday', { label });
  const [y, m, d] = balanceAt.split('-').map(Number) as [number, number, number];
  return t('home.balances.captionOn', { label, day: d, month: monthOfDay(m), year: yearSuffix(y, currentYear) });
}

/** «September», «December 2025»: the year only when it is not the current one. */
export function monthName(month: string, currentYear: number): string {
  const [y, m] = month.split('-').map(Number) as [number, number];
  return `${calendarMonthName(m)}${yearSuffix(y, currentYear)}`;
}

/** «in September», «in December 2025». */
export function monthIn(month: string, currentYear: number): string {
  const [y, m] = month.split('-').map(Number) as [number, number];
  return t('home.balances.inMonth', { month: t(`home.balances.monthIn.${m as MonthNumber}`), year: yearSuffix(y, currentYear) });
}

/** «1 person», «3 people». */
export function peopleCount(n: number): string {
  return t('home.balances.peopleCount', n);
}

/** «1 account», «8 accounts». */
export function accountsCount(n: number): string {
  return t('home.balances.accountsCount', n);
}

/** «without 1 account», «without 5 accounts». */
function withoutAccounts(n: number): string {
  return t('home.balances.withoutAccounts', n);
}

export function netText(net: number, currency: number): string {
  const s = formatMoney(Math.abs(net), currency, { minorUnits: true });
  return `${net < 0 ? '−' : '+'}${s}`;
}

/** Whole units with `sign` in front; zero goes without a sign. */
export function signedMoney(value: number, currency: number, sign: '+' | '−'): string {
  const s = formatMoney(Math.abs(value), currency);
  return value === 0 ? s : `${sign}${s}`;
}

/** Spending as a whole percent of income; null without income. */
export function spentShare(income: number, spending: number): number | null {
  return income > 0 ? Math.round((spending / income) * 100) : null;
}

export function coverageNote(month: string, c: { from: string; to: string }): string {
  const m = Number(month.slice(5, 7));
  const last = new Date(Date.UTC(Number(month.slice(0, 4)), m, 0)).getUTCDate();
  if (c.from > `${month}-01`) return t('home.balances.coverageFrom', { day: Number(c.from.slice(8)), month: monthOfDay(m) });
  if (Number(c.to.slice(8)) < last) return t('home.balances.coverageTo', { day: Number(c.to.slice(8)), month: monthShortName(m) });
  return t('home.balances.wholeMonth');
}

/** Widths in % of each part: shares of `parts`, scaled so the larger of income / spending fills the bar. */
export function flowWidths(parts: ReadonlyArray<number>, value: number, other: number): number[] {
  const pos = parts.map((x) => Math.max(0, x));
  const sum = pos.reduce((s, x) => s + x, 0);
  const v = Math.max(0, value);
  const max = Math.max(v, other);
  return pos.map((x) => (sum > 0 && max > 0 ? (x / sum) * (v / max) * 100 : 0));
}

/** Hryvnia per whole unit, 2 decimals, comma: «44,36». Rounded on the cents so 44.355 does not fall to 44,35. */
function rateText(rate: number, currency: number): string {
  const perUnit = rate * 10 ** (currencyExponent(currency) - currencyExponent(UAH));
  return (Math.round(perUnit * 100) / 100).toFixed(2).replace('.', ',');
}

/** The rate line of a total card: what other currencies went into its sums and at what rate, or what was left out. */
export function fxNote(fx: ReadonlyArray<FxPart>): string {
  return fx
    .filter((p) => p.income !== 0 || p.spending !== 0)
    .map((p) => {
      const amount = formatMoney(Math.abs(p.income !== 0 ? p.income : p.spending), p.currency);
      if (p.rate === null) return t('home.balances.fxNoRate', { amount });
      return t(p.nearest ? 'home.balances.fxNearestRate' : 'home.balances.fxRate', { amount, rate: rateText(p.rate, p.currency) });
    })
    .join(' · ');
}

function others(total: CardTotal): string {
  return total.others.map((o) => formatMoney(o.ownFunds, o.currency, { minorUnits: true })).join(' · ');
}

export function slidesOf(
  v: MonthOverview,
  ctx: { people: ReadonlyArray<Readonly<PersonView>>; selectedId: number | null; currentYear: number },
): Slide[] {
  const caption = balanceCaption(v.balanceAt, ctx.currentYear);
  const month = monthIn(v.month, ctx.currentYear);
  const totalSlide = (key: string, title: string, total: CardTotal, accents: string[], countText: string): Slide => {
    const approxIncome = total.fx.some((p) => p.rate !== null && p.income !== 0);
    const approxSpending = total.fx.some((p) => p.rate !== null && p.spending !== 0);
    return {
      key,
      title,
      caption,
      accents,
      dim: false,
      amount: formatMoney(total.ownFunds, UAH, { minorUnits: true }),
      others: others(total),
      bottom: [countText, total.missing > 0 ? withoutAccounts(total.missing) : ''].filter((s) => s !== '').join(' · '),
      net: total.income - total.spending,
      netText: `${approxIncome || approxSpending ? '≈ ' : ''}${netText(total.income - total.spending, UAH)} ${month}`,
      flow: { currency: UAH, income: total.income, spending: total.spending, color: accents[0] ?? colorVar(null), approxIncome, approxSpending, note: fxNote(total.fx) },
    };
  };
  if (ctx.selectedId === null) {
    const accents = v.people.map((p) => colorVar(p.color));
    const family = totalSlide('family', t('entities.participant.family'), v.total, accents, `${peopleCount(v.people.length)} · ${accountsCount(v.total.accounts)}`);
    family.flow.segments = v.people.map((p) => ({ color: colorVar(p.color), income: p.total.income, spending: p.total.spending }));
    return [family, ...v.people.map((p) => totalSlide(`p${p.participantId}`, p.label, p.total, [colorVar(p.color)], accountsCount(p.total.accounts)))];
  }
  const person = ctx.people.find((p) => p.id === ctx.selectedId);
  const accent = colorVar(person?.color ?? null);
  const kindOf = (a: MonthOverview['accounts'][number]) =>
    t(a.kind === 'jar' ? 'home.balances.kind.jar' : a.creditLimit > 0 ? 'home.balances.kind.credit' : a.currency !== UAH ? 'home.balances.kind.fx' : 'home.balances.kind.card');
  return [
    totalSlide('person', person?.label ?? '', v.total, [accent], accountsCount(v.total.accounts)),
    ...v.accounts.map(
      (a): Slide => ({
        key: a.id,
        title: a.label,
        accents: [accent],
        dim: a.ownFunds === null,
        caption: a.ownFunds === null ? t('home.balances.noDataOnDate') : balanceCaption(v.balanceAt, ctx.currentYear, kindOf(a)),
        amount: a.ownFunds === null ? '—' : formatMoney(a.ownFunds, a.currency, { minorUnits: true }),
        others: '',
        bottom: a.creditLimit > 0 ? t('home.balances.limit', { amount: formatMoney(a.creditLimit, a.currency) }) : ['Monobank', person?.label ?? ''].filter((x) => x !== '').join(' · '),
        net: a.ownFunds === null ? null : a.income - a.spending,
        netText: `${netText(a.income - a.spending, a.currency)} ${month}`,
        flow: { currency: a.currency, income: a.income, spending: a.spending, color: accent },
      }),
    ),
  ];
}
