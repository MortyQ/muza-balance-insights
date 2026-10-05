// Dates and day starts in a time zone the app passes in (format.ts): the desktop passes the system's, the Kyiv
// helpers (local_date, MCP output) are the same functions with Europe/Kyiv.
import { describe, expect, it } from 'vitest';
import { dateIn, dateTimeIn, kyivStartOfDay, startOfDayIn, toKyivDate, toKyivDateTime } from '../src/format.ts';

/** 23:10 in Berlin (CEST) on 5 Oct 2026 — 00:10 on 6 Oct in Kyiv. */
const BERLIN_LATE = Date.UTC(2026, 9, 5, 21, 10) / 1000;
/** 22:30 in New York (EST, UTC−5) on 14 Jan 2026 — 05:30 on 15 Jan in Kyiv. */
const NEW_YORK_LATE = Date.UTC(2026, 0, 15, 3, 30) / 1000;

describe('dates in a given time zone', () => {
  it('Berlin at 23:10 is still the same day; Kyiv is past midnight', () => {
    expect(dateIn(BERLIN_LATE, 'Europe/Berlin')).toBe('2026-10-05');
    expect(dateTimeIn(BERLIN_LATE, 'Europe/Berlin')).toBe('2026-10-05 23:10');
    expect(toKyivDate(BERLIN_LATE)).toBe('2026-10-06');
    expect(toKyivDateTime(BERLIN_LATE)).toBe('2026-10-06 00:10');
  });

  it('UTC−5: the evening keeps its date', () => {
    expect(dateIn(NEW_YORK_LATE, 'America/New_York')).toBe('2026-01-14');
    expect(dateTimeIn(NEW_YORK_LATE, 'America/Bogota')).toBe('2026-01-14 22:30');
  });

  it('the start of a day is the local midnight of that zone', () => {
    expect(startOfDayIn('2026-10-05', 'Europe/Berlin')).toBe(Date.UTC(2026, 9, 4, 22, 0) / 1000);
    expect(startOfDayIn('2026-01-14', 'America/New_York')).toBe(Date.UTC(2026, 0, 14, 5, 0) / 1000);
    expect(kyivStartOfDay('2026-10-05')).toBe(startOfDayIn('2026-10-05', 'Europe/Kyiv'));
    expect(kyivStartOfDay('2026-10-05')).toBe(Date.UTC(2026, 9, 4, 21, 0) / 1000);
  });

  it('an invalid date is refused', () => {
    expect(() => startOfDayIn('2026-02-30', 'Europe/Berlin')).toThrow(RangeError);
  });
});
