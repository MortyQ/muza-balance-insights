// The user's calendar: «today», a day's or a month's start and every date or time on screen follow the system time
// zone — wherever the user is, not Kyiv. Instants stay epoch seconds/ms everywhere and become a date or a time only at
// the edge, through this module (main, the import worker and the renderer). Main turns a date back into an instant
// with the core's startOfDayIn(date, systemTimeZone()), and passes the zone to every core period (`tz`), so sums by day
// and by month count the user's days too (`transactions.local_date` stays the Kyiv date; periods match by `time`).

const formats = new Map<string, Intl.DateTimeFormat>();

function formatIn(timeZone: string): Intl.DateTimeFormat {
  let f = formats.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
    formats.set(timeZone, f);
  }
  return f;
}

function partsOf(ms: number, timeZone: string): Record<string, string> {
  return Object.fromEntries(formatIn(timeZone).formatToParts(ms).map((p) => [p.type, p.value]));
}

/** The system's IANA time zone («Europe/Berlin»), read at each call; UTC when the platform names none. */
export function systemTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

/** The calendar date `YYYY-MM-DD` of an instant (epoch ms) in `timeZone`, the system's by default. */
export function localDate(ms: number, timeZone: string = systemTimeZone()): string {
  const p = partsOf(ms, timeZone);
  return `${p.year}-${p.month}-${p.day}`;
}

/** `YYYY-MM-DD HH:mm` of an instant (epoch ms) in `timeZone`, the system's by default. */
export function localDateTime(ms: number, timeZone: string = systemTimeZone()): string {
  const p = partsOf(ms, timeZone);
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}`;
}

// 'YYYY-MM-DD' holds three numbers by construction (calendar dates of main, the core and the renderer).
const ymd = (date: string) => date.split('-').map(Number) as [number, number, number];

/** 'YYYY-MM-DD' shifted by `n` days (UTC calendar arithmetic, no timezone drift). */
export function shiftDate(date: string, n: number): string {
  const [y, m, d] = ymd(date);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** 1 = Monday … 7 = Sunday. */
export function isoWeekday(date: string): number {
  const [y, m, d] = ymd(date);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay() || 7;
}
