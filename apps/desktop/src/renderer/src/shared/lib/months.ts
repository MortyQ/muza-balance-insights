// Calendar months for the spending screen, in Kyiv time (the same zone the core uses for local_date).
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

const kyivDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Kyiv', year: 'numeric', month: '2-digit', day: '2-digit' });

/** Today's Kyiv date, YYYY-MM-DD. */
export function kyivToday(now: Date): string {
  return kyivDate.format(now);
}

export function monthOf(date: string): YearMonth {
  return date.slice(0, 7) as YearMonth;
}

export function shiftMonth(ym: YearMonth, by: number): YearMonth {
  const [y, m] = ym.split('-').map(Number) as [number, number];
  const total = y * 12 + (m - 1) + by;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`;
}

/** Inclusive local_date range of the month. */
export function monthRange(ym: YearMonth): { from: string; to: string } {
  const [y, m] = ym.split('-').map(Number) as [number, number];
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${ym}-01`, to: `${ym}-${String(last).padStart(2, '0')}` };
}

/** «September 2026». */
export function monthTitle(ym: YearMonth): string {
  const [y, m] = ym.split('-').map(Number) as [number, number];
  return `${monthName(m)} ${y}`;
}

/** «2026-03-10» → «10.03»; «2026-03-10 23:00» → «10.03, 23:00». */
export function shortDate(s: string): string {
  const [date, time] = s.split(' ');
  const [, mm, dd] = (date ?? '').split('-');
  return time ? `${dd}.${mm}, ${time}` : `${dd}.${mm}`;
}
