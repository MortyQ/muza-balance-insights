// The detail screens' period in main: its calendar days and the period it is compared with. Calendar dates of the
// system time zone (YYYY-MM-DD), plain calendar arithmetic.
import type { DetailPeriod, SpendingOverview } from '../shared/api.ts';
import { isoWeekday, shiftDate } from './now.ts';
import { comparePeriod, monthBounds } from './spending.ts';

/** The days of a period: one day, Monday … Sunday, a whole month. Throws on a week not from a Monday or a period after `today`. */
export function periodBounds(p: DetailPeriod, today: string): { from: string; to: string } {
  const b = p.kind === 'day' ? { from: p.date, to: p.date } : p.kind === 'week' ? { from: p.from, to: shiftDate(p.from, 6) } : monthBounds(p.month);
  if (p.kind === 'week' && isoWeekday(p.from) !== 1) throw new Error('period: a week starts on a Monday');
  if (b.from > today) throw new Error('period: starts after today');
  return b;
}

/**
 * What a period is compared with: a month — last month (comparePeriod); a week — last week, cut to the weekdays the
 * data reaches while this week is incomplete; a day — nothing. Null when the data does not cover the earlier start.
 */
export function periodCompare(
  p: DetailPeriod,
  bounds: { from: string; to: string },
  info: Readonly<SpendingOverview['period']>,
  dataFrom: string | null,
): SpendingOverview['compare'] {
  if (p.kind === 'month') return comparePeriod(p.month, info, dataFrom);
  if (p.kind === 'day') return null;
  const from = shiftDate(bounds.from, -7);
  if (dataFrom === null || dataFrom > from) return null;
  if (info.incomplete && info.dataUntil !== null && info.dataUntil < bounds.to) {
    if (info.dataUntil < bounds.from) return null;
    return { from, to: shiftDate(info.dataUntil, -7), partial: true };
  }
  return { from, to: shiftDate(bounds.to, -7), partial: false };
}
