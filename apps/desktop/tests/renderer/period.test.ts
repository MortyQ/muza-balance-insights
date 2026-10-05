import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useMonthStore } from '@/entities/period';
import { inTimeZone } from '../helpers/time-zone.ts';

describe('month store', () => {
  beforeEach(() => setActivePinia(createPinia()));
  it('starts at the current month; set clamps to [first, this month]', () => {
    const s = useMonthStore();
    expect(s.month).toBe(s.thisMonth);
    s.set('2099-01', '2025-06');
    expect(s.month).toBe(s.thisMonth);
    s.set('2020-01', '2025-06');
    expect(s.month).toBe('2025-06');
    s.set('2025-08', '2025-06');
    expect(s.month).toBe('2025-08');
  });

  describe('refresh', () => {
    afterEach(() => vi.useRealTimers());

    it('recomputes thisMonth for the current clock, without moving the user\'s chosen month', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-09-27T12:00:00Z'));
      const s = useMonthStore();
      expect(s.thisMonth).toBe('2026-09');
      s.set('2026-06', '2025-06');
      expect(s.month).toBe('2026-06');

      vi.setSystemTime(new Date('2026-10-02T12:00:00Z'));
      s.refresh();
      expect(s.thisMonth).toBe('2026-10');
      expect(s.month).toBe('2026-06');
    });

    it('today: the local date (Kyiv in this suite), recomputed by refresh (a new day while the app stays open)', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-10-03T20:59:00Z')); // 23:59 in Kyiv
      const s = useMonthStore();
      expect(s.today).toBe('2026-10-03');
      vi.setSystemTime(new Date('2026-10-03T21:01:00Z')); // 00:01 in Kyiv
      expect(s.today).toBe('2026-10-03');
      s.refresh();
      expect(s.today).toBe('2026-10-04');
    });
  });

  describe('in Berlin', () => {
    inTimeZone('Europe/Berlin');
    afterEach(() => vi.useRealTimers());

    it('at 23:10 on the month\'s last day it is still that day and that month (Kyiv is in the next one)', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-09-30T21:10:00Z'));
      const s = useMonthStore();
      expect(s.today).toBe('2026-09-30');
      expect(s.thisMonth).toBe('2026-09');
      vi.setSystemTime(new Date('2026-09-30T22:01:00Z')); // 00:01 in Berlin
      s.refresh();
      expect(s.today).toBe('2026-10-01');
      expect(s.thisMonth).toBe('2026-10');
    });
  });

  describe('in New York (UTC−5 in winter)', () => {
    inTimeZone('America/New_York');
    afterEach(() => vi.useRealTimers());

    it('the evening of 31 January is still January', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-02-01T03:30:00Z')); // 22:30 on 31 Jan in New York, 05:30 on 1 Feb in Kyiv
      const s = useMonthStore();
      expect(s.today).toBe('2026-01-31');
      expect(s.thisMonth).toBe('2026-01');
    });
  });
});
