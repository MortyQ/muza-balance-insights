// Calendar months and dates for the screens, in the system time zone (@contract/dates.ts).
import { localDate } from '@contract/dates.ts';
import { t } from './i18n.ts';

export type YearMonth = `${number}-${string}`;

/** The month's name in the interface language, as a standalone word («September»). */
export function monthName(month: number): string {
  return t(`common.month.${month as MonthNumber}`);
}

/** Short name for the month grid («Sep»). */
export function monthShortName(month: number): string {
  return t(`common.monthShort.${month as MonthNumber}`);
}

type MonthNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

/** «5 April» (genitive in uk / ru); «5 April 2025» outside `currentYear`. */
export function dayMonthName(date: string, currentYear: number): string {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return `${d} ${t(`common.monthGen.${m as MonthNumber}`)}${y === currentYear ? '' : ` ${y}`}`;
}

/** Today's date in the system time zone, YYYY-MM-DD. */
export function localToday(now: Date): string {
  return localDate(now.getTime());
}

export function monthOf(date: string): YearMonth {
  return date.slice(0, 7) as YearMonth;
}

export function shiftMonth(ym: YearMonth, by: number): YearMonth {
  const [y, m] = ym.split('-').map(Number) as [number, number];
  const total = y * 12 + (m - 1) + by;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`;
}

/** «2026-03-10» → «10.03»; «2026-03-10 23:00» → «10.03, 23:00». */
export function shortDate(s: string): string {
  const [date, time] = s.split(' ');
  const [, mm, dd] = (date ?? '').split('-');
  return time ? `${dd}.${mm}, ${time}` : `${dd}.${mm}`;
}

/** «2026-03-10» → «10.03.2026». */
export function fullDate(date: string): string {
  const [yyyy, mm, dd] = date.split('-');
  return `${dd}.${mm}.${yyyy}`;
}

/** When a sync happened (local «YYYY-MM-DD HH:mm» from main): today → «at 14:20», an earlier day → «10.03, 14:20». */
export function syncedWhen(at: string, now: Date): string {
  const [date, time] = at.split(' ');
  return date === localToday(now) && time ? t('common.atTime', { time }) : shortDate(at);
}
