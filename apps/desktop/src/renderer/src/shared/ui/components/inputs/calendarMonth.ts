// Ours, not copied — pure "YYYY-MM" <-> @internationalized/date conversions for VMonthPicker. VMonthPicker's public
// value type is a "YYYY-MM" string (the 1st of the month inside a CalendarDate); reka-ui's MonthPicker works with
// CalendarDate internally.
import { CalendarDate, type DateValue } from '@internationalized/date';

const MONTH_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;

/** "2025-06" -> CalendarDate 2025-06-01; anything else -> undefined. */
export function monthToCalendar(ym: string | null | undefined): CalendarDate | undefined {
  const m = ym ? MONTH_RE.exec(ym) : null;
  return m ? new CalendarDate(Number(m[1]), Number(m[2]), 1) : undefined;
}

/** Formats a DateValue back to "YYYY-MM", or null when there is no date. */
export function calendarToMonth(d: DateValue | null): string | null {
  return d ? `${d.year}-${String(d.month).padStart(2, '0')}` : null;
}
