// Pure functions, no DOM — parsing/formatting edge cases for "YYYY-MM" <-> CalendarDate.
import { describe, expect, it } from 'vitest';
import { calendarToMonth, monthToCalendar } from '@/shared/ui/components/inputs/calendarMonth.ts';

describe('calendarMonth', () => {
  it('YYYY-MM <-> CalendarDate (the 1st of the month)', () => {
    const d = monthToCalendar('2025-06');
    expect(d?.toString()).toBe('2025-06-01');
    expect(calendarToMonth(d ?? null)).toBe('2025-06');
  });

  it('rejects anything but YYYY-MM', () => {
    expect(monthToCalendar('2025-6')).toBeUndefined();
    expect(monthToCalendar('2025-13')).toBeUndefined();
    expect(monthToCalendar('2025-00')).toBeUndefined();
    expect(monthToCalendar(null)).toBeUndefined();
    expect(monthToCalendar(undefined)).toBeUndefined();
    expect(calendarToMonth(null)).toBeNull();
  });
});
