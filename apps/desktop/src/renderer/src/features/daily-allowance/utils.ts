import type { AllowanceReserve } from '@contract/allowance.ts';
import type { AllowanceOverview } from '@contract/api.ts';
import type { MoneyFormat } from '@/entities/currency-display';
import { dayMonthName, formatMoney, t } from '@/shared/lib';
import type { AllowanceView, BreakdownLine, ReserveFieldValue } from './types.ts';

/** A reserve typed in whole units of its currency: minor units, or null — not a whole number from 0 up to the limit. */
export function reserveMinor(text: string, max: number): number | null {
  const s = text.trim().replace(/\s+/g, '');
  if (!/^\d+$/.test(s)) return null;
  const k = Number(s) * 100;
  return k <= max ? k : null;
}

/**
 * The reserve field in the screen's currency: the saved one as is when it is that currency, else converted at today's
 * rate (the next save keeps it in the screen's currency). Without a rate for the saved one: in its own currency.
 */
export function reserveField(r: AllowanceOverview['reserve'], fmt: MoneyFormat): ReserveFieldValue {
  const shown = fmt.currency as AllowanceReserve['currency'];
  if (r.currency === shown) return { currency: shown, units: Math.round(r.amount / 100) };
  if (r.uah !== null) return { currency: shown, units: Math.round(fmt.convert(r.uah) / 100) };
  return { currency: r.currency, units: Math.round(r.amount / 100) };
}

export function allowanceView(v: AllowanceOverview, fmt: MoneyFormat, currentYear: number): AllowanceView {
  const day = (d: string) => dayMonthName(d, currentYear);
  const days = t('home.allowance.days', v.days);
  const toIncome = v.income !== null && !v.income.overdue;
  const income = !v.income
    ? t('home.allowance.noIncome')
    : v.income.overdue
      ? t('home.allowance.incomeLate', { date: day(v.income.date) })
      : t('home.allowance.income', { name: v.income.name, amount: fmt.money(v.income.uah) });
  const minus = (k: number) => `−${fmt.money(k)}`;
  const lines: BreakdownLine[] = [
    { label: t('home.allowance.money'), amount: fmt.money(v.money), strong: false },
    ...(v.reserve.amount > 0
      ? [{ label: t('home.allowance.reserve'), amount: v.reserve.uah === null ? t('home.allowance.noRate') : minus(v.reserve.uah), strong: false }]
      : []),
    ...v.mandatory.map((p) => ({
      label: t('home.allowance.payment', { name: p.name, date: day(p.due) }),
      amount: p.uah === null ? t('home.allowance.noRate') : minus(p.uah),
      strong: false,
    })),
    { label: t('home.allowance.free'), amount: v.free < 0 ? minus(-v.free) : fmt.money(v.free), strong: true },
    { label: t('home.allowance.perDay', { days }), amount: fmt.money(v.perDay), strong: true },
  ];
  return {
    amount: v.free < 0 ? fmt.money(-v.free) : fmt.money(v.perDay),
    short: v.free < 0,
    until: toIncome ? t('home.allowance.untilIncome', { date: day(v.until), days }) : t('home.allowance.untilMonthEnd', { days }),
    income,
    lines,
    leftOut: v.leftOut.map((l) => t('home.balances.fxNoRate', { amount: formatMoney(l.ownFunds, l.currency) })).join(' · '),
  };
}
