import type { FopTaxOverview, Quarter } from '@contract/api.ts';
import type { MoneyFormat } from '@/entities/currency-display';
import { formatMoney, i18n, t } from '@/shared/lib';
import { AMOUNT_MAX, PERCENT_MAX, YEARS_BACK } from './constants.ts';
import type { BaseChoice, FopTaxView, TaxRowView } from './types.ts';

/** The years the picker offers: this one and YEARS_BACK before it, newest first. */
export function yearOptions(current: number): number[] {
  return Array.from({ length: YEARS_BACK + 1 }, (_, i) => current - i);
}

/** A quarter is offered unless it is after today's. */
export function quarterAllowed(year: number, quarter: Quarter, current: { year: number; quarter: Quarter }): boolean {
  return year < current.year || (year === current.year && quarter <= current.quarter);
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
  const s = text.trim().replace(/[\s ]/g, '').replace(',', '.');
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
 * The result rows: from the FOP income — the quarter and the year to date; from a typed amount — that amount alone.
 * No rows without a valid percent (or amount).
 */
export function taxView(
  v: Readonly<FopTaxOverview>,
  input: { percent: number | null; base: BaseChoice; amount: number | null },
  fmt: MoneyFormat,
): FopTaxView {
  const { percent } = input;
  const row = (label: string, base: number): TaxRowView => {
    const tax = taxMinor(base, percent ?? 0);
    return { label, base: fmt.money(base), baseAlso: fmt.approx(base), tax: fmt.money(tax), taxAlso: fmt.approx(tax) };
  };
  const quarterName = t('fopTax.quarterName', { n: v.quarter, year: v.year });
  const rows =
    percent === null
      ? []
      : input.base === 'custom'
        ? input.amount === null
          ? []
          : [row(t('fopTax.customIncome'), input.amount)]
        : [row(t('fopTax.quarterIncome', { period: quarterName }), v.base.total), row(t('fopTax.yearIncome'), v.yearToDate.total)];
  const fromIncome = input.base === 'income';
  return {
    rateText: percent === null ? '' : t('fopTax.fromIncome', { percent: percentText(percent) }),
    rows,
    running: fromIncome && v.base.incomplete,
    leftOut: fromIncome && v.yearToDate.leftOut.length > 0 ? t('fopTax.leftOut', { amounts: v.yearToDate.leftOut.map((l) => formatMoney(l.total, l.currency)).join(' · ') }) : '',
  };
}
