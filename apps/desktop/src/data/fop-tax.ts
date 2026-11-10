// The FOP tax screen's periods (DataService.fopTaxOverview): the picked days and the year to their end, as calendar
// days of the system time zone. Pure.

/**
 * The picked days cut at today, and the year from 1 January of the end's year to that end. A start after today or
 * after the end is refused.
 */
export function fopTaxBounds(from: string, to: string, today: string): { period: { from: string; to: string }; year: { from: string; to: string } } {
  if (from > today) throw new Error('period: starts after today');
  if (from > to) throw new Error('period: starts after its end');
  const end = to > today ? today : to;
  return { period: { from, to: end }, year: { from: `${end.slice(0, 4)}-01-01`, to: end } };
}
