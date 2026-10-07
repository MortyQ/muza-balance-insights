import type { RecurringOverview, RecurringPaymentView } from '@contract/api.ts';
import { CATEGORY_ICON, categoryName } from '@/entities/category';
import type { MoneyFormat } from '@/entities/currency-display';
import { formatMoney, t } from '@/shared/lib';
import type { RecurringRowView, RecurringSummaryView } from './types.ts';

type MonthNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

/** «5 April»; «5 April 2025» outside the current year. */
export function dayText(date: string, currentYear: number): string {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return `${d} ${t(`common.monthGen.${m as MonthNumber}`)}${y === currentYear ? '' : ` ${y}`}`;
}

export function summaryView(v: RecurringOverview, fmt: MoneyFormat, currentYear: number): RecurringSummaryView {
  return {
    total: fmt.money(v.monthly),
    mandatory: v.mandatory > 0 ? t('recurring.mandatoryPart', { amount: fmt.money(v.mandatory) }) : '',
    approx: fmt.approxInline(v.monthly),
    count: t('recurring.count', v.active.length),
    since: t('recurring.since', { date: dayText(v.since, currentYear) }),
  };
}

export function rowView(
  p: RecurringPaymentView,
  ctx: { fmt: MoneyFormat; currentYear: number; active: boolean; person: { name: string; color: string } | null },
): RecurringRowView {
  const category = categoryName(p);
  return {
    key: p.key,
    name: p.name,
    caption: ctx.person ? `${category} · ${ctx.person.name}` : category,
    icon: CATEGORY_ICON[p.categoryId ?? 'rest'],
    amount: p.uah === null ? formatMoney(p.amount, p.currency) : ctx.fmt.money(p.uah),
    operation: p.operation ? formatMoney(p.operation.amount, p.operation.currency, { minorUnits: true }) : '',
    when: ctx.active ? t('recurring.next', { date: dayText(p.next, ctx.currentYear) }) : t('recurring.last', { date: dayText(p.last, ctx.currentYear) }),
    person: ctx.person,
    mandatory: p.mark === 'mandatory',
  };
}
