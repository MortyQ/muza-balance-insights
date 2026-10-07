import type { DetailPeriod } from '@contract/api.ts';
/** A bar with a value is at least this tall (% of the largest), so it stays visible. */
export const MIN_BAR = 4;

/** The list's order. */
export const SORTS = ['date', 'amount'] as const;

/** The list's columns: when, the text, who, marks, amount (header and rows alike). */
export const OPERATION_COLS = 'grid grid-cols-[7.5rem_minmax(0,1fr)_10rem_11rem_8rem] gap-3';

/**
 * What a detail screen shows for each period: one day has no 12 months, no «per day», no weekdays and no days of the
 * month; a week has no 12 months and no days of the month.
 */
export const PERIOD_BLOCKS = {
  day: { months: false, weekdays: false, days: false, perDay: false },
  week: { months: false, weekdays: true, days: false, perDay: true },
  month: { months: true, weekdays: true, days: true, perDay: true },
} as const satisfies Record<DetailPeriod['kind'], { months: boolean; weekdays: boolean; days: boolean; perDay: boolean }>;
