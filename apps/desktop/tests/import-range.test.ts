// How far back a user's import may start: one rule for the screen and for main (src/shared/import-range.ts).
import { describe, expect, it } from 'vitest';
import { IMPORT_MAX_MONTHS, IMPORT_PRESETS, importFloor, isImportFrom, isIsoDate, monthsBefore } from '../src/shared/import-range.ts';

describe('monthsBefore (the day clamped to the month)', () => {
  it.each([
    [1, '2026-02-28'], // 31 Mar − 1 month → end of February
    [3, '2025-12-31'],
    [12, '2025-03-31'],
    [24, '2024-03-31'],
    [25, '2024-02-29'], // a leap February
  ] as const)('%i month(s) before 31 Mar 2026 → %s', (n, date) => {
    expect(monthsBefore('2026-03-31', n)).toBe(date);
  });
  it('across the year, and 0 is the same day', () => {
    expect(monthsBefore('2026-01-15', 1)).toBe('2025-12-15');
    expect(monthsBefore('2026-01-15', 0)).toBe('2026-01-15');
  });
});

describe('isIsoDate', () => {
  it('a real date in the YYYY-MM-DD form only', () => {
    for (const d of ['2026-01-01', '2024-02-29']) expect(isIsoDate(d)).toBe(true);
    for (const d of ['2023-02-29', '2026-13-01', '2026-00-10', '2026-01-32', '2026-1-01', '2026-01-01T00:00', '']) expect(isIsoDate(d)).toBe(false);
  });
});

describe('isImportFrom', () => {
  const today = '2026-10-05';
  it('from 36 months back up to today', () => {
    expect(IMPORT_MAX_MONTHS).toBe(36);
    expect(importFloor(today)).toBe('2023-10-05');
    expect(isImportFrom('2023-10-05', today)).toBe(true);
    expect(isImportFrom(today, today)).toBe(true);
    expect(isImportFrom('2023-10-04', today)).toBe(false);
    expect(isImportFrom('2026-10-06', today)).toBe(false);
    expect(isImportFrom('2026-02-30', today)).toBe(false);
  });
  it('every quick pick is accepted; the longest is the floor', () => {
    for (const n of IMPORT_PRESETS) expect(isImportFrom(monthsBefore(today, n), today)).toBe(true);
    expect(monthsBefore(today, Math.max(...IMPORT_PRESETS))).toBe(importFloor(today));
  });
});
