// Calendar quarters (the FOP tax screen): shared by the data process and the renderer. Pure, no dependencies.
import type { Quarter } from './api.ts';

const pad = (n: number) => String(n).padStart(2, '0');
const lastDay = (year: number, month: number) => new Date(Date.UTC(year, month, 0)).getUTCDate();

/** The quarter a date (YYYY-MM-DD) falls in. */
export function quarterOf(date: string): { year: number; quarter: Quarter } {
  return { year: Number(date.slice(0, 4)), quarter: (Math.floor((Number(date.slice(5, 7)) - 1) / 3) + 1) as Quarter };
}

/** The quarter's first and last day. */
export function quarterBounds(year: number, quarter: Quarter): { from: string; to: string } {
  const first = (quarter - 1) * 3 + 1;
  const last = first + 2;
  return { from: `${year}-${pad(first)}-01`, to: `${year}-${pad(last)}-${pad(lastDay(year, last))}` };
}
