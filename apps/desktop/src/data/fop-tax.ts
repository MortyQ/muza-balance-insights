// The FOP tax screen's periods (DataService.fopTaxOverview): a quarter of a year and the year to its end, as calendar
// days of the system time zone. Pure.
import type { Quarter } from '../shared/api.ts';
import { quarterBounds } from '../shared/quarters.ts';

/**
 * The picked quarter and the year from 1 January to that quarter's end, both cut at today. A quarter that starts
 * after today is refused.
 */
export function fopTaxBounds(year: number, quarter: Quarter, today: string): { quarter: { from: string; to: string }; year: { from: string; to: string } } {
  const q = quarterBounds(year, quarter);
  if (q.from > today) throw new Error('quarter: starts after today');
  const to = q.to > today ? today : q.to;
  return { quarter: { from: q.from, to }, year: { from: `${year}-01-01`, to } };
}
