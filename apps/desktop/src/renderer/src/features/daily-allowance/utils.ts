import type { AllowanceOverview } from '@contract/api.ts';
import type { MoneyFormat } from '@/entities/currency-display';
import { dayMonthName, formatMoney, t } from '@/shared/lib';
import type { AllowanceView, BreakdownLine, ReserveRowView } from './types.ts';

/** An amount typed in whole units of its currency: minor units, or null — not a whole number from 0 up to the limit. */
export function reserveMinor(text: string, max: number): number | null {
  const s = text.trim().replace(/\s+/g, '');
  if (!/^\d+$/.test(s)) return null;
  const k = Number(s) * 100;
  return k <= max ? k : null;
}

/** The reserves list: each in its own currency, ≈ the screen's when that differs, its term. */
export function reserveRows(v: AllowanceOverview, fmt: MoneyFormat, currentYear: number): ReserveRowView[] {
  return v.reserves.map((r) => ({
    id: r.id,
    name: r.name,
    amount: formatMoney(r.amount, r.currency),
    approx: r.currency !== fmt.currency && r.uah !== null ? `≈ ${fmt.money(r.uah)}` : '',
    term:
      r.until === null
        ? t('home.allowance.reserves.noEnd')
        : t(r.active ? 'home.allowance.reserves.until' : 'home.allowance.reserves.expired', { date: dayMonthName(r.until, currentYear) }),
    active: r.active,
    input: { name: r.name, currency: r.currency, amount: r.amount, until: r.until },
  }));
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
    ...v.reserves
      .filter((r) => r.active && r.amount > 0)
      .map((r) => ({ label: t('home.allowance.reserveLine', { name: r.name }), amount: r.uah === null ? t('home.allowance.noRate') : minus(r.uah), strong: false })),
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
