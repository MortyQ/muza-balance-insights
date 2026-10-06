import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { compareText, rangePresets, useMonthStore, useRangeStore } from '@/entities/period';
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

describe('the analytics period', () => {
  beforeEach(() => setActivePinia(createPinia()));
  afterEach(() => vi.useRealTimers());

  it('defaults to the last 12 whole months; set() orders it and keeps it inside [floor, this month]', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-06T12:00:00'));
    const s = useRangeStore();
    expect(s.range).toEqual({ from: '2025-10', to: '2026-09' });
    expect(s.single).toBe(false);
    s.set({ from: '2020-01', to: '2027-01' }, '2023-10');
    expect(s.range).toEqual({ from: '2023-10', to: '2026-10' });
    s.set({ from: '2026-05', to: '2026-02' }, '2023-10');
    expect(s.range).toEqual({ from: '2026-02', to: '2026-05' });
    s.set({ from: '2026-09', to: '2026-09' }, '2023-10');
    expect(s.single).toBe(true);
  });

  it('quick picks: one month, and ranges of whole months ending last month, not before the floor', () => {
    const p = rangePresets('2026-10', '2023-10');
    expect(p.month.map((x) => [x.id, x.from, x.to])).toEqual([['this', '2026-10', '2026-10'], ['last', '2026-09', '2026-09'], ['yago', '2025-10', '2025-10']]);
    expect(p.range.map((x) => [x.id, x.from, x.to])).toEqual([
      ['3', '2026-07', '2026-09'], ['6', '2026-04', '2026-09'], ['12', '2025-10', '2026-09'], ['24', '2024-10', '2026-09'], ['36', '2023-10', '2026-09'],
      ['ytd', '2026-01', '2026-09'], ['ly', '2025-01', '2025-12'], ['all', '2023-10', '2026-09'],
    ]);
    expect(p.range.map((x) => x.label).slice(0, 3)).toEqual(['3 месяца', '6 месяцев', '12 месяцев']);
    // January: «since January» would be the running month alone.
    expect(rangePresets('2026-01', '2023-01').range.map((x) => x.id)).not.toContain('ytd');
  });

  it('the note: what the pick is compared with, and the running month', () => {
    expect(compareText({ from: '2026-09', to: '2026-09' }, '2026-10', '2024-01-01')).toEqual({ compare: 'Для сравнения: август 2026', running: null });
    expect(compareText({ from: '2025-10', to: '2026-10' }, '2026-10', '2024-01-01')).toEqual({
      compare: 'Для сравнения: сен 2024 – сен 2025',
      running: 'Октябрь ещё идёт — суммы неполные',
    });
    expect(compareText({ from: '2025-10', to: '2026-09' }, '2026-10', '2025-01-01').compare).toBe('Для сравнения не хватает истории');
  });
});
