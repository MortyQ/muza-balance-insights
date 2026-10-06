// The analytics screen's period rules, shared by main (IPC check) and the renderer (picker): whole months, YYYY-MM.
import { IMPORT_MAX_MONTHS } from './import-range.ts';

/** The longest range: the import floor's months plus the current one. */
export const ANALYTICS_MAX_MONTHS = IMPORT_MAX_MONTHS + 1;

const index = (m: string): number => Number(m.slice(0, 4)) * 12 + Number(m.slice(5, 7)) - 1;

/** `'2026-12'` + 1 → `'2027-01'`. */
export function addMonths(month: string, n: number): string {
  const i = index(month) + n;
  return `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}`;
}

/** Months in [from, to], both included (0 or less when from > to). */
export function monthSpan(from: string, to: string): number {
  return index(to) - index(from) + 1;
}
