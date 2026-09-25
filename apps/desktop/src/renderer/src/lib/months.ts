// Calendar months for the spending screen, in Kyiv time (the same zone the core uses for local_date).
export type YearMonth = `${number}-${string}`;

const MONTHS = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];

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

/** «сентябрь 2026». */
export function monthTitle(ym: YearMonth): string {
  const [y, m] = ym.split('-').map(Number) as [number, number];
  return `${MONTHS[m - 1]} ${y}`;
}

/** «2026-03-10» → «10.03»; «2026-03-10 23:00» → «10.03, 23:00». */
export function shortDate(s: string): string {
  const [date, time] = s.split(' ');
  const [, mm, dd] = (date ?? '').split('-');
  return time ? `${dd}.${mm}, ${time}` : `${dd}.${mm}`;
}
