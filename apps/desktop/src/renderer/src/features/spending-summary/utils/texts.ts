import type { SpendingOverview } from '@contract/api.ts';
import { formatMoney, monthName, shortDate, t } from '@/shared/lib';
import { prevIn, type MonthNumber } from './month.ts';

/** Why the numbers may be partial or empty; null when the month is complete. */
export function periodNote(p: Readonly<SpendingOverview['period']>): string | null {
  if (p.dataUntil === null) return t('home.spending.noData');
  if (p.dataUntil < p.from) return t('home.spending.notYet', { date: shortDate(p.dataUntil) });
  if (!p.incomplete) return null;
  return t('home.spending.partial', { date: shortDate(p.dataUntil) });
}

/**
 * The period compared with, for `home.spending.compareFull`: the month («August», with the year when it is not
 * `thisYear`), or its days while this month is in progress («Aug 1–2»).
 */
export function comparePeriodText(compare: Readonly<NonNullable<SpendingOverview['compare']>>, thisYear: number): string {
  const y = Number(compare.from.slice(0, 4));
  const m = Number(compare.from.slice(5, 7));
  if (compare.partial) {
    const month = t(`common.monthGen.${m as MonthNumber}`);
    const from = Number(compare.from.slice(8, 10));
    const to = Number(compare.to.slice(8, 10));
    return from === to ? t('home.spending.compareDay', { day: from, month }) : t('home.spending.compareRange', { from, to, month });
  }
  const name = monthName(m);
  return y === thisYear ? name : `${name} ${y}`;
}

/** `home.spending.inMonth` («In August») — the stats line under the ring. */
export function prevInText(month: string): string {
  return t('home.spending.inMonth', { month: prevIn(month) });
}

/** `home.spending.noCompare` — last month is not covered by the data. */
export function noCompareText(month: string): string {
  return t('home.spending.noCompare', { month: prevIn(month) });
}

/** `home.spending.leftOut` lines: currencies without a rate, out of the totals. */
export function leftOutLines(view: Readonly<SpendingOverview>): string[] {
  return view.leftOut.map((l) => t('home.spending.leftOut', { amount: formatMoney(l.net, l.currency) }));
}
