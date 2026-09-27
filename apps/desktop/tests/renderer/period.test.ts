import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useMonthStore } from '@/entities/period';

describe('month store', () => {
  beforeEach(() => setActivePinia(createPinia()));
  it('starts at the current Kyiv month; set clamps to [first, this month]', () => {
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
  });
});
