// Periods as instants: [from, to] are calendar days of a time zone (the app passes the user's; Kyiv by default, which
// is what the MCP server and `transactions.local_date` use). A row belongs to the period by its `time`, so a purchase
// at 23:05 in Berlin falls on the Berlin day whatever local_date says.
import { TIMEZONE } from './constants.ts';
import { parseLocalDate, startOfDayIn } from './format.ts';

/** Calendar days [from, to] (YYYY-MM-DD, inclusive) of `tz`, an IANA name; absent → Kyiv. */
export type ZonedPeriod = { from: string; to: string; tz?: string };

export const zoneOf = (p: { tz?: string }): string => p.tz ?? TIMEZONE;

/** True for an IANA name the platform knows. */
export function isTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function addDays(date: string, n: number): string {
  const p = parseLocalDate(date)!;
  return new Date(Date.UTC(p.y, p.m - 1, p.d + n)).toISOString().slice(0, 10);
}

/** Unix seconds [startSec, endSec) of the period in its zone. */
export function periodRange(p: ZonedPeriod): { startSec: number; endSec: number } {
  const tz = zoneOf(p);
  return { startSec: startOfDayIn(p.from, tz), endSec: startOfDayIn(addDays(p.to, 1), tz) };
}

/** SQL condition on `<alias>.time` for the period; its two arguments come from periodArgs. */
export const periodSql = (alias: string) => `${alias}.time >= ? AND ${alias}.time < ?`;

export function periodArgs(p: ZonedPeriod): [number, number] {
  const { startSec, endSec } = periodRange(p);
  return [startSec, endSec];
}

/**
 * The period cut into days (key YYYY-MM-DD) or months (key YYYY-MM, the first and last cut to the period) of its zone,
 * as JSON `[[key, startSec, endSec], …]` for BUCKETS_CTE. SQLite knows no time zones; a table of the zone's own day
 * starts stays right across DST, where a fixed offset would not.
 */
export function periodBuckets(p: ZonedPeriod, unit: 'day' | 'month'): string {
  const tz = zoneOf(p);
  const out: Array<[string, number, number]> = [];
  let start = startOfDayIn(p.from, tz);
  for (let d = p.from; d <= p.to; ) {
    const next = addDays(d, 1);
    const end = startOfDayIn(next, tz);
    const key = unit === 'day' ? d : d.slice(0, 7);
    const last = out[out.length - 1];
    if (last && last[0] === key) last[2] = end;
    else out.push([key, start, end]);
    start = end;
    d = next;
  }
  return JSON.stringify(out);
}

/** Buckets b(k, s, e) from one JSON argument (periodBuckets). */
export const BUCKETS_CTE =
  "buckets AS MATERIALIZED (SELECT json_extract(value, '$[0]') AS k, json_extract(value, '$[1]') AS s, json_extract(value, '$[2]') AS e FROM json_each(?))";

/** The bucket key of a row by its time column (`expr`). */
export const bucketKeySql = (expr: string) => `(SELECT b.k FROM buckets b WHERE ${expr} >= b.s AND ${expr} < b.e)`;
