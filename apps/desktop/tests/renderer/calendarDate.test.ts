// ISO <-> @internationalized/date conversions used by VDatepicker (shared/ui/components/inputs/calendarDate.ts).
// Pure functions, no DOM — just parsing/formatting edge cases: invalid input, range order, month/leap edges.
import { CalendarDate } from '@internationalized/date';
import { describe, expect, it } from 'vitest';
import {
  calendarDateToIso,
  calendarRangeToIso,
  isoRangeToCalendarRange,
  isoToCalendarDate,
} from '@/shared/ui/components/inputs/calendarDate.ts';

describe('isoToCalendarDate', () => {
  it('parses a valid ISO date', () => {
    const date = isoToCalendarDate('2024-03-15');
    expect(date).toEqual(new CalendarDate(2024, 3, 15));
  });

  it('returns null for null/undefined/empty input', () => {
    expect(isoToCalendarDate(null)).toBeNull();
    expect(isoToCalendarDate(undefined)).toBeNull();
    expect(isoToCalendarDate('')).toBeNull();
  });

  it('returns null for a malformed string', () => {
    for (const bad of ['2024-3-5', '2024/03/15', '15-03-2024', '2024-03-15T00:00', 'not-a-date', '2024-03-15 ']) {
      expect(isoToCalendarDate(bad), bad).toBeNull();
    }
  });

  it('returns null for a calendar-invalid date', () => {
    expect(isoToCalendarDate('2024-02-30')).toBeNull(); // February never has 30 days
    expect(isoToCalendarDate('2023-02-29')).toBeNull(); // 2023 is not a leap year
    expect(isoToCalendarDate('2024-13-01')).toBeNull(); // no month 13
    expect(isoToCalendarDate('2024-00-01')).toBeNull(); // no month 0
    expect(isoToCalendarDate('2024-01-00')).toBeNull(); // no day 0
  });

  it('accepts the leap day on a leap year', () => {
    expect(isoToCalendarDate('2024-02-29')).toEqual(new CalendarDate(2024, 2, 29));
  });

  it('handles month-end boundaries', () => {
    expect(isoToCalendarDate('2024-04-30')).toEqual(new CalendarDate(2024, 4, 30));
    expect(isoToCalendarDate('2024-04-31')).toBeNull(); // April has 30 days
    expect(isoToCalendarDate('2024-12-31')).toEqual(new CalendarDate(2024, 12, 31));
  });
});

describe('calendarDateToIso', () => {
  it('formats a CalendarDate back to YYYY-MM-DD, zero-padded', () => {
    expect(calendarDateToIso(new CalendarDate(2024, 3, 5))).toBe('2024-03-05');
    expect(calendarDateToIso(new CalendarDate(2024, 12, 31))).toBe('2024-12-31');
  });

  it('returns null for null/undefined', () => {
    expect(calendarDateToIso(null)).toBeNull();
    expect(calendarDateToIso(undefined)).toBeNull();
  });

  it('round-trips through isoToCalendarDate', () => {
    for (const iso of ['2024-01-01', '2024-02-29', '2000-12-31']) {
      expect(calendarDateToIso(isoToCalendarDate(iso))).toBe(iso);
    }
  });
});

describe('isoRangeToCalendarRange', () => {
  it('converts both ends', () => {
    expect(isoRangeToCalendarRange({ start: '2024-01-01', end: '2024-01-31' })).toEqual({
      start: new CalendarDate(2024, 1, 1),
      end: new CalendarDate(2024, 1, 31),
    });
  });

  it('swaps a reversed range so start is never after end', () => {
    expect(isoRangeToCalendarRange({ start: '2024-01-31', end: '2024-01-01' })).toEqual({
      start: new CalendarDate(2024, 1, 1),
      end: new CalendarDate(2024, 1, 31),
    });
  });

  it('leaves an equal start/end alone', () => {
    expect(isoRangeToCalendarRange({ start: '2024-01-15', end: '2024-01-15' })).toEqual({
      start: new CalendarDate(2024, 1, 15),
      end: new CalendarDate(2024, 1, 15),
    });
  });

  it('turns invalid or missing endpoints into undefined without throwing', () => {
    expect(isoRangeToCalendarRange({ start: null, end: null })).toEqual({ start: undefined, end: undefined });
    expect(isoRangeToCalendarRange({ start: '2024-02-30', end: '2024-01-15' })).toEqual({
      start: undefined,
      end: new CalendarDate(2024, 1, 15),
    });
  });
});

describe('calendarRangeToIso', () => {
  it('formats both ends', () => {
    expect(calendarRangeToIso({ start: new CalendarDate(2024, 1, 1), end: new CalendarDate(2024, 1, 31) })).toEqual({
      start: '2024-01-01',
      end: '2024-01-31',
    });
  });

  it('formats missing endpoints as null', () => {
    expect(calendarRangeToIso({ start: undefined, end: undefined })).toEqual({ start: null, end: null });
  });
});
