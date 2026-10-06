// The user's calendar (src/shared/dates.ts): dates and times in the system time zone, never a fixed Kyiv.
import { describe, expect, it } from 'vitest';
import { localDate, localDateTime, systemTimeZone } from '../src/shared/dates.ts';
import { inTimeZone } from './helpers/time-zone.ts';

/** 23:10 in Berlin (CEST, UTC+2) on 5 Oct 2026 — 00:10 on 6 Oct in Kyiv. */
const BERLIN_LATE = Date.UTC(2026, 9, 5, 21, 10);
/** 22:30 in New York (EST, UTC−5) on 14 Jan 2026 — 05:30 on 15 Jan in Kyiv. */
const NEW_YORK_LATE = Date.UTC(2026, 0, 15, 3, 30);

describe('the system time zone', () => {
  describe('Europe/Berlin', () => {
    inTimeZone('Europe/Berlin');
    it('is read from the system at each call', () => {
      expect(systemTimeZone()).toBe('Europe/Berlin');
    });
    it('23:10 is still today, not the Kyiv tomorrow', () => {
      expect(localDate(BERLIN_LATE)).toBe('2026-10-05');
      expect(localDateTime(BERLIN_LATE)).toBe('2026-10-05 23:10');
    });
    it('midnight is 00:00 of the new day, never 24:00', () => {
      expect(localDateTime(Date.UTC(2026, 9, 5, 22, 0))).toBe('2026-10-06 00:00');
    });
  });

  describe('America/New_York (UTC−5 in winter)', () => {
    inTimeZone('America/New_York');
    it('the evening keeps its own date', () => {
      expect(localDate(NEW_YORK_LATE)).toBe('2026-01-14');
      expect(localDateTime(NEW_YORK_LATE)).toBe('2026-01-14 22:30');
    });
  });

  it('an explicit zone wins over the system one', () => {
    expect(localDate(BERLIN_LATE, 'Europe/Kyiv')).toBe('2026-10-06');
    expect(localDateTime(NEW_YORK_LATE, 'America/Bogota')).toBe('2026-01-14 22:30');
  });
});
