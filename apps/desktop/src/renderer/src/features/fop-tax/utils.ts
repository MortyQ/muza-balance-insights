import type { FopTaxOverview, Quarter } from '@contract/api.ts';
import type { MoneyFormat } from '@/entities/currency-display';
import { formatMoney, i18n, monthName, monthShortName, t } from '@/shared/lib';
import type { MonthRangePreset } from '@/shared/ui';
import { AMOUNT_MAX, PERCENT_MAX } from './constants.ts';
import type { BaseChoice, FopTaxView, PeriodPick, TaxRowView } from './types.ts';

const lastDay = (year: number, month: number) => new Date(Date.UTC(year, month, 0)).getUTCDate();
const monthNum = (ym: string) => Number(ym.slice(5, 7));
const yearNum = (ym: string) => Number(ym.slice(0, 4));
const ym = (year: number, month: number) => `${year}-${String(month).padStart(2, '0')}`;

/** The picked months' first and last day (main cuts the end at today). */
export function periodBounds(p: PeriodPick): { from: string; to: string } {
  return { from: `${p.from}-01`, to: `${p.to}-${String(lastDay(yearNum(p.to), monthNum(p.to))).padStart(2, '0')}` };
}

/**
 * The quarter the pick is: its first month to its last, or to this month while the quarter runs; null — not a quarter.
 * A quarter also shows the year to date.
 */
export function quarterOfPick(p: PeriodPick, thisMonth: string): { year: number; quarter: Quarter } | null {
  const m = monthNum(p.from);
  if ((m - 1) % 3 !== 0 || yearNum(p.to) !== yearNum(p.from)) return null;
  const end = ym(yearNum(p.from), m + 2);
  return p.to === end || (p.to === thisMonth && p.to < end) ? { year: yearNum(p.from), quarter: ((m - 1) / 3 + 1) as Quarter } : null;
}

/** The pick in words: «September 2026», «Q4 2026», «2026», «Mar 2026 – Jun 2026». */
export function periodName(p: PeriodPick, thisMonth: string): string {
  if (p.from === p.to) return `${monthName(monthNum(p.from))} ${yearNum(p.from)}`;
  const q = quarterOfPick(p, thisMonth);
  if (q) return t('fopTax.quarterName', { n: q.quarter, year: q.year });
  const y = yearNum(p.from);
  if (p.from === ym(y, 1) && (p.to === ym(y, 12) || (p.to === thisMonth && yearNum(thisMonth) === y))) return t('fopTax.yearName', { year: y });
  return `${monthShortName(monthNum(p.from))} ${yearNum(p.from)} – ${monthShortName(monthNum(p.to))} ${yearNum(p.to)}`;
}

/** The picker's quick picks: this and last month; this and last quarter, this and last year (never past this month). */
export function fopPresets(thisMonth: string): { month: MonthRangePreset[]; range: MonthRangePreset[] } {
  const y = yearNum(thisMonth);
  const m = monthNum(thisMonth);
  const last = m === 1 ? ym(y - 1, 12) : ym(y, m - 1);
  const qStart = Math.floor((m - 1) / 3) * 3 + 1;
  const lastQ = qStart === 1 ? { from: ym(y - 1, 10), to: ym(y - 1, 12) } : { from: ym(y, qStart - 3), to: ym(y, qStart - 1) };
  return {
    month: [
      { id: 'this', label: t('fopTax.preset.thisMonth'), from: thisMonth, to: thisMonth },
      { id: 'last', label: t('fopTax.preset.lastMonth'), from: last, to: last },
    ],
    range: [
      { id: 'q', label: t('fopTax.preset.thisQuarter'), from: ym(y, qStart), to: thisMonth },
      { id: 'lq', label: t('fopTax.preset.lastQuarter'), ...lastQ },
      { id: 'y', label: t('fopTax.preset.thisYear'), from: ym(y, 1), to: thisMonth },
      { id: 'ly', label: t('fopTax.preset.lastYear', { year: y - 1 }), from: ym(y - 1, 1), to: ym(y - 1, 12) },
    ],
  };
}

/** A typed percent («5», «5,5», «0.5»): above 0, at most PERCENT_MAX, up to two decimals; null — not one. */
export function percentValue(text: string): number | null {
  const s = text.trim().replace(',', '.');
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(s)) return null;
  const n = Number(s);
  return n > 0 && n <= PERCENT_MAX ? n : null;
}

/** A typed amount in hryvnias («20 000», «1500,50») → kopecks; null — not one, or zero. */
export function amountMinor(text: string): number | null {
  const s = text.trim().replace(/[\s ]/g, '').replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const n = Math.round(Number(s) * 100);
  return n > 0 && n <= AMOUNT_MAX * 100 ? n : null;
}

/** The tax: the percent of the base, rounded to a kopeck. */
export function taxMinor(base: number, percent: number): number {
  return Math.round((base * percent) / 100);
}

/** «5%», «5,5%» in the current language. */
export function percentText(p: number): string {
  return `${new Intl.NumberFormat(i18n.global.locale.value, { maximumFractionDigits: 2 }).format(p)}%`;
}

/**
 * The result rows: from income — the period and, when the answer has it (a quarter), the year to date; from a typed
 * amount — that amount alone. No rows without a valid percent (or amount).
 */
export function taxView(
  v: Readonly<FopTaxOverview> | null,
  input: { percent: number | null; base: BaseChoice; amount: number | null; period: string },
  fmt: MoneyFormat,
): FopTaxView {
  const { percent } = input;
  const row = (label: string, base: number): TaxRowView => {
    const tax = taxMinor(base, percent ?? 0);
    return { label, base: fmt.money(base), baseAlso: fmt.approx(base), tax: fmt.money(tax), taxAlso: fmt.approx(tax) };
  };
  const fromIncome = input.base !== 'custom' && v !== null;
  const rows =
    percent === null
      ? []
      : input.base === 'custom'
        ? input.amount === null
          ? []
          : [row(t('fopTax.customIncome'), input.amount)]
        : v === null
          ? []
          : [
              row(t('fopTax.periodIncome', { period: input.period }), v.base.total),
              ...(v.yearToDate ? [row(t('fopTax.yearIncome'), v.yearToDate.total)] : []),
            ];
  const leftOut = fromIncome ? (v.yearToDate ?? v.base).leftOut : [];
  return {
    rateText: percent === null ? '' : t('fopTax.fromIncome', { percent: percentText(percent) }),
    rows,
    running: fromIncome && v.base.incomplete,
    leftOut: leftOut.length > 0 ? t('fopTax.leftOut', { amounts: leftOut.map((l) => formatMoney(l.total, l.currency)).join(' · ') }) : '',
  };
}
