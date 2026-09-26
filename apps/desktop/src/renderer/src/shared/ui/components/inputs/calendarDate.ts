// Ours, not copied — pure ISO <-> @internationalized/date conversions for VDatepicker. VDatepicker's public value
// type is ISO "YYYY-MM-DD" strings; reka-ui's DatePicker/DateRangePicker work with CalendarDate internally.
import { type CalendarDate, parseDate } from "@internationalized/date";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Parses a "YYYY-MM-DD" string into a CalendarDate. Returns null for empty/missing input, a malformed string, or a
 * string that is not a real calendar date (e.g. "2024-02-30").
 */
export function isoToCalendarDate(iso: string | null | undefined): CalendarDate | null {
  if (!iso || !ISO_DATE.test(iso)) return null;
  try {
    return parseDate(iso);
  } catch {
    return null;
  }
}

/** Formats a CalendarDate back to "YYYY-MM-DD", or null when there is no date. */
export function calendarDateToIso(date: CalendarDate | null | undefined): string | null {
  return date ? date.toString() : null;
}

export interface IsoDateRange {
  start: string | null;
  end: string | null;
}

export interface CalendarDateRange {
  start: CalendarDate | undefined;
  end: CalendarDate | undefined;
}

/**
 * Converts an ISO date range to a CalendarDate range. Invalid endpoints become undefined; a reversed range
 * (end before start) is swapped so `start` is never after `end`.
 */
export function isoRangeToCalendarRange(range: IsoDateRange): CalendarDateRange {
  const start = isoToCalendarDate(range.start) ?? undefined;
  const end = isoToCalendarDate(range.end) ?? undefined;
  if (start && end && start.compare(end) > 0) return { start: end, end: start };
  return { start, end };
}

/** Converts a CalendarDate range back to ISO strings. */
export function calendarRangeToIso(range: CalendarDateRange): IsoDateRange {
  return {
    start: calendarDateToIso(range.start ?? null),
    end: calendarDateToIso(range.end ?? null),
  };
}
