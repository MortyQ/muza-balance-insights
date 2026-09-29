import type { FilterRowWidths } from './types.ts';

/**
 * Whether the person buttons fit centred in the row: the middle column of `1fr auto 1fr` is as wide as the row minus
 * two of the wider side and the two gaps around it. Before the first measurement (row 0): fits, so the first frame
 * shows the buttons rather than a select that flips to them.
 */
export function fitsCenter(w: Readonly<FilterRowWidths>, gap: number): boolean {
  return w.row === 0 || w.center + 2 * gap + 2 * Math.max(w.left, w.right) <= w.row;
}
