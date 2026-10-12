import type { SpendingOverview } from '@contract/api.ts';
import { t } from '@/shared/lib';

export type MonthNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

/** The month before `month` ('YYYY-MM') as a number 1–12. */
export function prevMonthNumber(month: string): MonthNumber {
  const m = Number(month.slice(5, 7));
  // 'YYYY-MM' holds a month 01–12, so m − 1 (or 12 for January) is within 1–12.
  return (m === 1 ? 12 : m - 1) as MonthNumber;
}
export const prevIn = (month: string) => t(`common.monthIn.${prevMonthNumber(month)}`);

/** The comparison covers only the same days of last month (this month is in progress). */
export const partial = (view: Readonly<SpendingOverview>) => view.compare?.partial ?? false;
