import { currencyAlpha, currencyExponent } from '@mono/core/shared/currency';
import type { AnalyticsOverview, CardTotal, FxPart, MonthOverview, PersonView } from '@contract/api.ts';
import type { SummaryCardProps } from '@/entities/account';
import { accountName, bankOf } from '@/entities/bank';
import type { MoneyFormat } from '@/entities/currency-display';
import { colorVar } from '@/entities/participant';
import { currencySymbol, formatAmount, formatMoney, monthName as calendarMonthName, monthShortName, t, UAH } from '@/shared/lib';
import { CARD_STEP, CARD_WIDTH, CLOSE_STAGGER, OPEN_STAGGER, ROW_INSET, SHARES_NAMED, STACK_DEPTH } from './constants.ts';
import type { ChartOption } from '@/shared/ui';
import type { Flow, FreeLineView, PaceView, RowView, Slide } from './types.ts';

/** Where card `i` sits: in the stack (up to STACK_DEPTH peeking behind, the rest hidden) or in the row, which scrolls. */
export function slidePosition(i: number, open: boolean): { x: number; y: number; z: number; opacity: number } {
  if (open) return { x: i * CARD_STEP, y: ROW_INSET, z: 20 - i, opacity: 1 };
  const depth = Math.min(i, STACK_DEPTH);
  return { x: depth * 22, y: ROW_INSET + 52 - depth * 16, z: 20 - i, opacity: i <= STACK_DEPTH ? 1 : 0 };
}

/** Transition delay of card `i` of `n`, ms: out one by one, back from the far end; paging moves all at once. */
export function slideDelay(i: number, n: number, open: boolean, paging: boolean): number {
  if (paging) return 0;
  return open ? i * OPEN_STAGGER : (n - i) * CLOSE_STAGGER;
}

/**
 * What the open row of `n` cards shows at this scroll: the cards wholly in view (`first`..`last`; the nearest one when
 * none fits whole), whether it is at either end, and whether everything fits. One pixel of slack for fractional scrolls.
 */
export function rowView(scrollLeft: number, clientWidth: number, n: number): RowView {
  const track = n * CARD_STEP - (CARD_STEP - CARD_WIDTH);
  const fits = n <= 1 || track <= clientWidth + 1;
  const last = Math.max(0, n - 1);
  const clamp = (i: number) => Math.min(last, Math.max(0, i));
  const first = clamp(Math.ceil((scrollLeft - 1) / CARD_STEP));
  const end = clamp(Math.floor((scrollLeft + clientWidth + 1 - CARD_WIDTH) / CARD_STEP));
  const nearest = clamp(Math.round(scrollLeft / CARD_STEP));
  return {
    first: end < first ? nearest : first,
    last: end < first ? nearest : end,
    atStart: fits || scrollLeft <= 1,
    atEnd: fits || scrollLeft + clientWidth >= track - 1,
    fits,
  };
}

const yearSuffix = (y: number, current: number) => (y === current ? '' : ` ${y}`);

type MonthNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
/** The month after a day number: «31 July» (genitive in uk / ru). */
const monthOfDay = (m: number) => t(`common.monthGen.${m as MonthNumber}`);

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
  return t('home.balances.inMonth', { month: t(`common.monthIn.${m as MonthNumber}`), year: yearSuffix(y, currentYear) });
}

/** «In October», «In December 2025»: the month tile of a summary card. */
export function monthInTitle(month: string, currentYear: number): string {
  const [y, m] = month.split('-').map(Number) as [number, number];
  return t('home.balances.inMonthTitle', { month: t(`common.monthIn.${m as MonthNumber}`), year: yearSuffix(y, currentYear) });
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

/** «Into jars +3 000 ₴» / «Out of jars −500 ₴» of a total card; null — no jar to tell. */
export function savedLine(flow: Flow): { label: string; amount: string } | null {
  if (!flow.saved) return null;
  const { amount, approx } = flow.saved;
  const out = amount < 0;
  return {
    label: t(out ? 'home.balances.savedOut' : 'home.balances.savedIn'),
    amount: (approx ? '≈ ' : '') + signedMoney(amount, flow.currency, out ? '−' : '+'),
  };
}

/** «Reserved 1 500 € ›» of the month panel, a link to the planning screen; null — no reserve against this card. */
export function reservedLine(flow: Flow): { label: string; amount: string } | null {
  if (flow.reserved === undefined) return null;
  return { label: t('home.balances.reserved'), amount: formatMoney(flow.reserved, flow.currency, { minorUnits: true }) };
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
      return t('home.balances.fxRate', { amount, rate: rateText(p.rate, p.currency) });
    })
    .join(' · ');
}

/** Whole percent of own funds that is free, 0–100; null — no reserves, or nothing of one's own to share out. */
export function freeShare(ownFunds: number, reserved: number | null): number | null {
  if (reserved === null || ownFunds <= 0) return null;
  return Math.min(100, Math.max(0, Math.round(((ownFunds - reserved) / ownFunds) * 100)));
}

/**
 * The family card's shares: each person's free amount (their own card's big figure). Two or more people only. The bar
 * has a part per non-zero amount, in the family's order, and none at all when nobody is above zero.
 */
export function sharesOf(
  people: MonthOverview['people'],
  label: (p: MonthOverview['people'][number]) => string,
  fmt: MoneyFormat,
): SummaryCardProps['people'] {
  if (people.length < 2) return null;
  const all = people.map((p) => {
    const value = p.total.ownFunds - (p.reserved ?? 0);
    return { name: firstName(label(p)), color: colorVar(p.color), amount: fmt.money(value), negative: value < 0, value };
  });
  const sorted = [...all].sort((a, b) => b.value - a.value);
  return {
    items: sorted.slice(0, SHARES_NAMED).map(({ name, color, amount, negative }) => ({ name, color, amount, negative })),
    more: sorted.length > SHARES_NAMED ? t('home.balances.morePeople', { n: sorted.length - SHARES_NAMED }) : '',
    all: sorted.map((p) => `${p.name} ${p.amount}`).join(' · '),
    parts: all.some((p) => p.value > 0) ? all.filter((p) => p.value !== 0).map(({ color, value }) => ({ color, value })) : [],
  };
}

/** A person's first name for the shares line: the first word of their label. */
export function firstName(label: string): string {
  return label.trim().split(/\s+/)[0] ?? '';
}

export function slidesOf(
  v: MonthOverview,
  ctx: { people: ReadonlyArray<Readonly<PersonView>>; selectedId: number | null; currentYear: number; fmt: MoneyFormat },
): Slide[] {
  const caption = balanceCaption(v.balanceAt, ctx.currentYear);
  const month = monthIn(v.month, ctx.currentYear);
  const monthTitle = monthInTitle(v.month, ctx.currentYear);
  const { fmt } = ctx;
  // `reserved`: today's reserves set against this card — the big figure is what is free, the real balance under it.
  const totalSlide = (
    key: string,
    title: string,
    total: CardTotal,
    accents: string[],
    countText: string,
    reserved: number | null,
    middle: { people: SummaryCardProps['people'] } | 'meter',
  ): Slide => {
    const approxIncome = total.fx.some((p) => p.rate !== null && p.income !== 0);
    const approxSpending = total.fx.some((p) => p.rate !== null && p.spending !== 0);
    const shown = total.ownFunds - (reserved ?? 0);
    const net = total.income - total.spending;
    return {
      key,
      kind: 'summary',
      card: {
        title,
        caption: reserved === null ? caption : balanceCaption(v.balanceAt, ctx.currentYear, t('home.balances.free')),
        accents,
        dim: false,
        count: [countText, total.missing > 0 ? withoutAccounts(total.missing) : ''].filter((s) => s !== '').join(' · '),
        amount: formatMoney(fmt.convert(shown), fmt.currency, { minorUnits: true }),
        fx: fmt.alsoParts(shown).map((p) => ({ symbol: currencySymbol(p.currency), code: currencyAlpha(p.currency), amount: formatAmount(p.minor, p.currency) })),
        negative: shown < 0,
        own: reserved === null ? null : { amount: fmt.money(total.ownFunds), negative: total.ownFunds < 0 },
        reserved: reserved === null ? null : fmt.money(reserved),
        people: middle === 'meter' ? null : middle.people,
        freeShare: middle === 'meter' ? freeShare(total.ownFunds, reserved) : null,
        net: { label: monthTitle, amount: net === 0 ? formatMoney(0, fmt.currency, { minorUnits: true }) : netText(fmt.convert(net), fmt.currency), value: net },
      },
      flow: {
        currency: fmt.currency,
        income: fmt.convert(total.income),
        spending: fmt.convert(total.spending),
        color: accents[0] ?? colorVar(null),
        approxIncome,
        approxSpending,
        note: fxNote(total.fx),
        ...(total.saved ? { saved: { amount: fmt.convert(total.saved.amount), approx: total.saved.approx } } : {}),
        ...(reserved !== null ? { reserved: fmt.convert(reserved) } : {}),
      },
      ...(reserved !== null ? { split: { own: total.ownFunds, reserved } } : {}),
    };
  };
  if (ctx.selectedId === null) {
    const accents = v.people.map((p) => colorVar(p.color));
    const label = (p: (typeof v.people)[number]) => (p.labelPending ? t('entities.participant.pending') : p.label);
    const family = totalSlide(
      'family',
      t('entities.participant.family'),
      v.total,
      accents,
      `${peopleCount(v.people.length)} · ${accountsCount(v.total.accounts)}`,
      v.reserved,
      { people: sharesOf(v.people, label, fmt) },
    );
    family.flow.segments = v.people.map((p) => ({ color: colorVar(p.color), income: fmt.convert(p.total.income), spending: fmt.convert(p.total.spending) }));
    return [
      family,
      ...v.people.map((p) =>
        totalSlide(`p${p.participantId}`, label(p), p.total, [colorVar(p.color)], accountsCount(p.total.accounts), p.reserved, 'meter'),
      ),
    ];
  }
  const person = ctx.people.find((p) => p.id === ctx.selectedId);
  const accent = colorVar(person?.color ?? null);
  const kindOf = (a: MonthOverview['accounts'][number]) =>
    t(a.kind === 'jar' ? 'home.balances.kind.jar' : a.creditLimit > 0 ? 'home.balances.kind.credit' : a.currency !== UAH ? 'home.balances.kind.fx' : 'home.balances.kind.card');
  return [
    totalSlide('person', person?.label ?? '', v.total, [accent], accountsCount(v.total.accounts), v.reserved, 'meter'),
    ...v.accounts.map(
      (a): Slide => ({
        key: a.id,
        kind: 'account',
        card: {
          bank: a.name.provider,
          title: accountName(a.name),
          accents: [accent],
          dim: a.ownFunds === null,
          caption: a.ownFunds === null ? t('home.balances.noDataOnDate') : balanceCaption(v.balanceAt, ctx.currentYear, kindOf(a)),
          amount: a.ownFunds === null ? '—' : formatMoney(a.ownFunds, a.currency, { minorUnits: true }),
          approx: '',
          actual: '',
          bottom: a.creditLimit > 0 ? t('home.balances.limit', { amount: formatMoney(a.creditLimit, a.currency) }) : [bankOf(a.name.provider).name, person?.label ?? ''].filter((x) => x !== '').join(' · '),
          net: a.ownFunds === null ? null : a.income - a.spending,
          netText: `${netText(a.income - a.spending, a.currency)} ${month}`,
        },
        flow: { currency: a.currency, income: a.income, spending: a.spending, color: accent },
      }),
    ),
  ];
}

/**
 * The month pace from one month of the analytics answer: the spending added up by day up to the last day with data,
 * the usual month's running spending, and the figures under the chart. null — not one day of the month has data.
 */
export function paceView(a: Readonly<AnalyticsOverview>, perDay: number | null): PaceView | null {
  if (a.unit !== 'day') return null;
  const last = a.buckets.findLastIndex((b) => b.state !== 'none');
  if (last < 0) return null;
  let sum = 0;
  const spent = a.buckets.map((b, i) => {
    sum += a.spending[i] ?? 0;
    return i <= last && b.state !== 'none' ? sum : null;
  });
  const running = a.buckets.some((b) => b.state === 'running');
  return {
    days: a.buckets.map((b) => String(Number(b.key.slice(8, 10)))),
    spent,
    usual: a.usual,
    last,
    running,
    spentTotal: spent[last] ?? 0,
    usualByNow: a.usual?.[last] ?? null,
    perDay: running ? perDay : null,
  };
}

/** The pace chart: the month solid, the usual dashed, today's point; amounts stay off the axes (the figures say them). */
export function paceChartOption(v: Readonly<PaceView>, money: (minor: number) => string = String): ChartOption {
  // Today's point carries its amount in a pill above it, as the home mockup draws it.
  const point = v.running
    ? [
        {
          coord: [v.last, v.spentTotal],
          label: {
            show: true,
            position: 'top',
            distance: 10,
            formatter: money(v.spentTotal),
            fontSize: 11,
            fontWeight: 700,
            color: 'var(--foreground)',
            backgroundColor: 'var(--surface)',
            borderColor: 'var(--border)',
            borderWidth: 1,
            borderRadius: 7,
            padding: [4, 8],
          },
        },
      ]
    : [];
  return {
    grid: { left: 4, right: 12, top: 30, bottom: 22, containLabel: true },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: v.days,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { fontSize: 10, color: 'var(--foreground-muted)', interval: (i: number) => i % 7 === 0 },
    },
    yAxis: {
      type: 'value',
      min: 0,
      splitNumber: 3,
      axisLabel: { fontSize: 10, color: 'var(--foreground-muted)', formatter: (n: number) => (n === 0 ? '0' : money(n)) },
      splitLine: { lineStyle: { color: 'var(--border-subtle)' } },
    },
    series: [
      ...(v.usual === null
        ? []
        : [
            {
              type: 'line',
              data: v.usual,
              symbol: 'none',
              silent: true,
              lineStyle: { type: 'dashed', width: 2, color: 'color-mix(in oklch, var(--primary) 35%, var(--surface))' },
            },
          ]),
      {
        type: 'line',
        data: v.spent,
        symbol: 'none',
        lineStyle: { width: 2.5, color: 'var(--primary)' },
        areaStyle: { color: 'var(--primary)', opacity: 0.12 },
        markPoint: { silent: true, symbol: 'circle', symbolSize: 9, itemStyle: { color: 'var(--primary)' }, label: { show: false }, data: point },
      },
    ],
  };
}

/** What the line under the stack shows for a card: a total's free amount with its reserve, an account's own funds. */
export function freeLineOf(slide: Readonly<Slide> | null): FreeLineView | null {
  if (!slide || slide.card.dim) return null;
  if (slide.kind === 'account') return { free: slide.card.amount, negative: false, reserved: null, share: null, short: false };
  const c = slide.card;
  const split = slide.split;
  if (!split || c.reserved === null) return { free: c.amount, negative: c.negative, reserved: null, share: null, short: false };
  const short = split.own < split.reserved;
  const share = short
    ? split.reserved > 0 ? Math.max(0, Math.min(100, Math.round((split.own / split.reserved) * 100))) : 0
    : Math.min(100, Math.max(0, Math.round(((split.own - split.reserved) / split.own) * 100)));
  return { free: c.amount, negative: c.negative, reserved: c.reserved, share, short };
}
