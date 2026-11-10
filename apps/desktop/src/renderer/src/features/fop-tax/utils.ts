import type { FopTaxOverview, Quarter } from '@contract/api.ts';
import { quarterBounds } from '@contract/quarters.ts';
import type { MoneyFormat } from '@/entities/currency-display';
import { formatMoney, fullDate, i18n, monthName, t } from '@/shared/lib';
import { AMOUNT_MAX, PERCENT_MAX, YEARS_BACK } from './constants.ts';
import type { BaseChoice, FopTaxView, PeriodPick, TaxRowView } from './types.ts';

/** The years the picker offers: this one and YEARS_BACK before it, newest first. */
export function yearOptions(current: number): number[] {
  return Array.from({ length: YEARS_BACK + 1 }, (_, i) => current - i);
}

/** A quarter is offered unless it is after today's. */
export function quarterAllowed(year: number, quarter: Quarter, current: { year: number; quarter: Quarter }): boolean {
  return year < current.year || (year === current.year && quarter <= current.quarter);
}

const lastDay = (year: number, month: number) => new Date(Date.UTC(year, month, 0)).getUTCDate();

/** The picked period's first and last day (main cuts the end at today). */
export function periodBounds(p: PeriodPick): { from: string; to: string } {
  switch (p.kind) {
    case 'month': {
      const [y, m] = p.month.split('-').map(Number) as [number, number];
      return { from: `${p.month}-01`, to: `${p.month}-${String(lastDay(y, m)).padStart(2, '0')}` };
    }
    case 'quarter':
      return quarterBounds(p.year, p.quarter);
    case 'year':
      return { from: `${p.year}-01-01`, to: `${p.year}-12-31` };
    case 'dates':
      return { from: p.from, to: p.to };
  }
}

/** The period in words: «September 2026», «Q4 2026», «2026», «15 March 2026 – 20 June 2026». */
export function periodName(p: PeriodPick): string {
  switch (p.kind) {
    case 'month': {
      const [y, m] = p.month.split('-').map(Number) as [number, number];
      return `${monthName(m)} ${y}`;
    }
    case 'quarter':
      return t('fopTax.quarterName', { n: p.quarter, year: p.year });
    case 'year':
      return t('fopTax.yearName', { year: p.year });
    case 'dates':
      return p.from === p.to ? fullDate(p.from) : `${fullDate(p.from)} – ${fullDate(p.to)}`;
  }
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
