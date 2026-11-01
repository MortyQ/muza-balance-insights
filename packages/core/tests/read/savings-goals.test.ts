// Savings goals (savings-goals.ts): progress, what is left, the need per month, overdue, a source that is gone.
import { describe, expect, it } from 'vitest';
import { savingProgress } from '../../src/read/savings-goals.ts';

describe('savings goal progress', () => {
  it('50 000 with 31 000 in the jar in November, a date in June: 62%, 19 000 left, 2 715 a month over 7 months', () => {
    expect(savingProgress(5_000_000, 3_100_000, '2027-06-01', '2026-11-01')).toEqual({
      progress: 3_100_000, percent: 62, left: 1_900_000, perMonth: 271_500, months: 7, overdue: false,
    });
  });

  it('no date: progress only; met: nothing left, no need', () => {
    expect(savingProgress(1_000_000, 400_000, null, '2026-11-01')).toMatchObject({ percent: 40, left: 600_000, perMonth: null, months: null });
    expect(savingProgress(1_000_000, 1_200_000, '2027-01-01', '2026-11-01')).toMatchObject({ percent: 100, left: 0, perMonth: null });
  });

  it('the date in this month asks for all that is left now; a passed date is overdue', () => {
    expect(savingProgress(1_000_000, 400_000, '2026-11-30', '2026-11-01')).toMatchObject({ months: 1, perMonth: 600_000 });
    expect(savingProgress(1_000_000, 400_000, '2026-10-01', '2026-11-01')).toMatchObject({ overdue: true, perMonth: null });
  });

  it('a jar that is gone: no progress', () => {
    expect(savingProgress(1_000_000, null, null, '2026-11-01')).toEqual({ progress: null, percent: null, left: null, perMonth: null, months: null, overdue: false });
  });
});
