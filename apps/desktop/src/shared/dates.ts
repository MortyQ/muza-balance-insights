// The user's calendar: «today», a day's or a month's start and every date or time on screen follow the system time
// zone — wherever the user is, not Kyiv. Instants stay epoch seconds/ms everywhere and become a date or a time only at
// the edge, through this module (main, the import worker and the renderer). Main turns a date back into an instant
// with the core's startOfDayIn(date, systemTimeZone()). Not covered yet: `transactions.local_date` is still the Kyiv
// date, so sums by day and by month (core periods) count Kyiv days.

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
