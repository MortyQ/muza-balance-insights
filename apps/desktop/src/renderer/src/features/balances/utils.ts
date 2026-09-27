import type { CardTotal, MonthOverview, PersonView } from '@contract/api.ts';
import { colorVar } from '@/entities/participant';
import { formatMoney } from '@/shared/lib';
import { CARD_STEP, CLOSE_STAGGER, MONTHS_GEN, MONTHS_IN, MONTHS_NOM, MONTHS_SHORT, OPEN_STAGGER, STACK_DEPTH, UAH, VISIBLE_CARDS } from './constants.ts';
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

export function balanceCaption(balanceAt: 'now' | string, currentYear: number): string {
  if (balanceAt === 'now') return 'Свои деньги · на сегодня';
  const [y, m, d] = balanceAt.split('-').map(Number) as [number, number, number];
  return `Свои деньги · на ${d} ${MONTHS_GEN[m - 1]}${yearSuffix(y, currentYear)}`;
}

/** «Сентябрь», «Декабрь 2025»: the year only when it is not the current one. */
export function monthName(month: string, currentYear: number): string {
  const [y, m] = month.split('-').map(Number) as [number, number];
  return `${MONTHS_NOM[m - 1]}${yearSuffix(y, currentYear)}`;
}

export function monthIn(month: string, currentYear: number): string {
  const [y, m] = month.split('-').map(Number) as [number, number];
  return `в ${MONTHS_IN[m - 1]}${yearSuffix(y, currentYear)}`;
}

function plural(n: number, one: string, few: string, many: string): string {
  const tens = n % 100;
  const ones = n % 10;
  const word = tens >= 11 && tens <= 14 ? many : ones === 1 ? one : ones >= 2 && ones <= 4 ? few : many;
  return `${n} ${word}`;
}

/** «1 человек», «3 человека», «5 человек». */
export function peopleCount(n: number): string {
  return plural(n, 'человек', 'человека', 'человек');
}

/** «1 счёт», «3 счёта», «8 счетов». */
export function accountsCount(n: number): string {
  return plural(n, 'счёт', 'счёта', 'счетов');
}

/** «без 1 счёта», «без 5 счетов». */
function withoutAccounts(n: number): string {
  return `без ${n} ${n % 10 === 1 && n % 100 !== 11 ? 'счёта' : 'счетов'}`;
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
  if (c.from > `${month}-01`) return `с ${Number(c.from.slice(8))} ${MONTHS_GEN[m - 1]}`;
  if (Number(c.to.slice(8)) < last) return `по ${Number(c.to.slice(8))} ${MONTHS_SHORT[m - 1]}`;
  return 'весь месяц';
}

/** Widths in % of each part: shares of `parts`, scaled so the larger of income / spending fills the bar. */
export function flowWidths(parts: ReadonlyArray<number>, value: number, other: number): number[] {
  const pos = parts.map((x) => Math.max(0, x));
  const sum = pos.reduce((s, x) => s + x, 0);
  const v = Math.max(0, value);
  const max = Math.max(v, other);
  return pos.map((x) => (sum > 0 && max > 0 ? (x / sum) * (v / max) * 100 : 0));
}

function others(t: CardTotal): string {
  return t.others.map((o) => formatMoney(o.ownFunds, o.currency, { minorUnits: true })).join(' · ');
}

export function slidesOf(
  v: MonthOverview,
  ctx: { people: ReadonlyArray<Readonly<PersonView>>; selectedId: number | null; currentYear: number },
): Slide[] {
  const caption = balanceCaption(v.balanceAt, ctx.currentYear);
  const month = monthIn(v.month, ctx.currentYear);
  const totalSlide = (key: string, title: string, t: CardTotal, accents: string[], countText: string): Slide => ({
    key,
    title,
    caption,
    accents,
    dim: false,
    amount: formatMoney(t.ownFunds, UAH, { minorUnits: true }),
    others: others(t),
    bottom: [countText, t.missing > 0 ? withoutAccounts(t.missing) : ''].filter((s) => s !== '').join(' · '),
    net: t.income - t.spending,
    netText: `${netText(t.income - t.spending, UAH)} ${month}`,
    flow: { currency: UAH, income: t.income, spending: t.spending, color: accents[0] ?? colorVar(null) },
  });
  if (ctx.selectedId === null) {
    const accents = v.people.map((p) => colorVar(p.color));
    const family = totalSlide('family', 'Вся семья', v.total, accents, `${peopleCount(v.people.length)} · ${accountsCount(v.total.accounts)}`);
    family.flow.segments = v.people.map((p) => ({ color: colorVar(p.color), income: p.total.income, spending: p.total.spending }));
    return [family, ...v.people.map((p) => totalSlide(`p${p.participantId}`, p.label, p.total, [colorVar(p.color)], accountsCount(p.total.accounts)))];
  }
  const person = ctx.people.find((p) => p.id === ctx.selectedId);
  const accent = colorVar(person?.color ?? null);
  const kindOf = (a: MonthOverview['accounts'][number]) =>
    a.kind === 'jar' ? 'Банка' : a.creditLimit > 0 ? 'Кредитка' : a.currency !== UAH ? 'Валютная карта' : 'Карта';
  return [
    totalSlide('person', person?.label ?? '', v.total, [accent], accountsCount(v.total.accounts)),
    ...v.accounts.map(
      (a): Slide => ({
        key: a.id,
        title: a.label,
        accents: [accent],
        dim: a.ownFunds === null,
        caption: a.ownFunds === null ? 'Нет данных на эту дату' : caption.replace('Свои деньги', kindOf(a)),
        amount: a.ownFunds === null ? '—' : formatMoney(a.ownFunds, a.currency, { minorUnits: true }),
        others: '',
        bottom: a.creditLimit > 0 ? `лимит ${formatMoney(a.creditLimit, a.currency)}` : ['Monobank', person?.label ?? ''].filter((x) => x !== '').join(' · '),
        net: a.ownFunds === null ? null : a.income - a.spending,
        netText: `${netText(a.income - a.spending, a.currency)} ${month}`,
        flow: { currency: a.currency, income: a.income, spending: a.spending, color: accent },
      }),
    ),
  ];
}
