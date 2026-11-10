import type { RecurringOverview, RecurringPaymentView } from '@contract/api.ts';
import { CATEGORY_ICON, categoryName } from '@/entities/category';
import type { MoneyFormat } from '@/entities/currency-display';
import { dayMonthName, formatMoney, t } from '@/shared/lib';
import type { RecurringRowView, RecurringSummaryView, RecurringTeaserView } from './types.ts';

export function summaryView(v: RecurringOverview, fmt: MoneyFormat, currentYear: number): RecurringSummaryView {
  return {
    total: fmt.money(v.monthly),
    mandatory: v.mandatory > 0 ? t('recurring.mandatoryPart', { amount: fmt.money(v.mandatory) }) : '',
    approx: fmt.approxInline(v.monthly),
    count: t('recurring.count', v.active.length),
    since: t('recurring.since', { date: dayMonthName(v.since, currentYear) }),
  };
}

export function teaserView(v: RecurringOverview, fmt: MoneyFormat): RecurringTeaserView {
  const count = t('recurring.count', v.active.length);
  const mandatory = v.mandatory > 0 ? t('recurring.mandatoryPart', { amount: fmt.money(v.mandatory) }) : '';
  return { total: fmt.money(v.monthly), caption: mandatory ? `${count} · ${mandatory}` : count };
}

export function rowView(
  p: RecurringPaymentView,
  ctx: { fmt: MoneyFormat; currentYear: number; today: string; active: boolean; person: { name: string; color: string } | null },
): RecurringRowView {
  const category = categoryName(p);
  const exact = [...(p.operation ? [p.operation] : []), { currency: p.currency, amount: p.amount }];
  return {
    key: p.key,
    name: p.name,
    caption: ctx.person ? `${category} · ${ctx.person.name}` : category,
    icon: CATEGORY_ICON[p.categoryId ?? 'rest'],
    amount: p.uah === null ? formatMoney(p.amount, p.currency) : ctx.fmt.money(p.uah),
    also: p.uah === null ? [] : ctx.fmt.alsoFor(p.uah, exact),
    operation: p.operation && !(p.uah !== null && ctx.fmt.alsoCurrencies.includes(p.operation.currency)) ? formatMoney(p.operation.amount, p.operation.currency, { minorUnits: true }) : '',
    when: ctx.active ? t('recurring.next', { date: dayMonthName(p.next, ctx.currentYear) }) : endedWhen(p.last, ctx.today, ctx.currentYear),
    person: ctx.person,
    mandatory: p.mark === 'mandatory',
  };
}

/** A stopped payment: «last 16 Jun · not seen for 4 months» (whole months of 30 days since the last payment). */
export function endedWhen(last: string, today: string, currentYear: number): string {
  const days = Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${last}T00:00:00Z`)) / 86_400_000);
  const months = Math.floor(days / 30);
  const lastText = t('recurring.last', { date: dayMonthName(last, currentYear) });
  return months >= 1 ? `${lastText} · ${t('recurring.notSeen', months)}` : lastText;
}
