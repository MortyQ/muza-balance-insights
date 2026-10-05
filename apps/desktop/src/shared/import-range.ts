// How far back a user's import may start: one rule for the screen (presets, the calendar's bounds) and for main (which
// checks the date the renderer sends). Kyiv dates, YYYY-MM-DD; plain calendar arithmetic, no time zones here.

/** The oldest start the screen offers and main accepts: this many months before today. */
export const IMPORT_MAX_MONTHS = 36;

/** The quick picks, in months before today. */
export const IMPORT_PRESETS = [1, 3, 6, 12, 24, IMPORT_MAX_MONTHS] as const;

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

const pad = (n: number) => String(n).padStart(2, '0');

/** A real calendar date in the YYYY-MM-DD form. */
export function isIsoDate(v: string): boolean {
  const m = ISO_DATE.exec(v);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  return mo >= 1 && mo <= 12 && d >= 1 && d <= new Date(Date.UTC(y, mo, 0)).getUTCDate();
}

/** The date `months` months before `date`, the day clamped to the month's length (31 Mar − 1 month = 28/29 Feb). */
export function monthsBefore(date: string, months: number): string {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  const total = y * 12 + (m - 1) - months;
  const ty = Math.floor(total / 12);
  const tm = (total % 12) + 1;
  const lastDay = new Date(Date.UTC(ty, tm, 0)).getUTCDate();
  return `${ty}-${pad(tm)}-${pad(Math.min(d, lastDay))}`;
}

/** The oldest start date allowed on `today`. */
export function importFloor(today: string): string {
  return monthsBefore(today, IMPORT_MAX_MONTHS);
}

/** A start date the import accepts on `today`: a real date from importFloor(today) up to today. */
export function isImportFrom(from: string, today: string): boolean {
  return isIsoDate(from) && from >= importFloor(today) && from <= today;
}
