// Pure helpers of the «Now» strip in main (DataService.nowOverview): calendar days, the week from Monday, and the
// usual day — the median of daily spending.
import type { SpendingAmounts } from '../shared/api.ts';
import { isoWeekday, shiftDate } from '../shared/dates.ts';

// The calendar helpers live in shared/dates.ts (the renderer counts weeks too); main's callers keep importing them here.
export { isoWeekday, shiftDate };

/** The usual day looks back this many days (today not included). */
export const USUAL_WINDOW = 30;
/** Fewer covered days than this — no usual day: a median of a few days says little. */
export const USUAL_MIN_DAYS = 7;

/** The middle value; for an even count the mean of the two middle ones, rounded to a kopeck. */
export function median(values: readonly number[]): number {
  const s = [...values].sort((x, y) => x - y);
  const mid = Math.floor(s.length / 2);
  const hi = s[mid] ?? 0;
  return s.length % 2 === 1 ? hi : Math.round(((s[mid - 1] ?? 0) + hi) / 2);
}

function datesIn(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = shiftDate(d, 1)) out.push(d);
  return out;
}

export function sumAmounts(list: Iterable<SpendingAmounts>): SpendingAmounts {
  let net = 0;
  let purchases = 0;
  for (const x of list) {
    net += x.net;
    purchases += x.purchases;
  }
  return { net, purchases };
}

/** The days [from, to] of a per-day map summed (a day without spending adds nothing). */
export function sumDays(byDay: ReadonlyMap<string, SpendingAmounts>, from: string, to: string): SpendingAmounts {
  return sumAmounts(datesIn(from, to).flatMap((d) => byDay.get(d) ?? []));
}

/** Median net of the days [from, to]; a day without spending counts as 0. Null under USUAL_MIN_DAYS days. */
export function usualDay(byDay: ReadonlyMap<string, SpendingAmounts>, from: string, to: string): number | null {
  const days = datesIn(from, to);
  return days.length < USUAL_MIN_DAYS ? null : median(days.map((d) => byDay.get(d)?.net ?? 0));
}

/** Net of Monday … Sunday of the week starting `monday`; null for the days after `today`. */
export function weekDays(byDay: ReadonlyMap<string, SpendingAmounts>, monday: string, today: string): Array<number | null> {
  return Array.from({ length: 7 }, (_, i) => {
    const d = shiftDate(monday, i);
    return d > today ? null : (byDay.get(d)?.net ?? 0);
  });
}
