import type { DetailPeriod } from '@contract/api.ts';
import { isIsoDate } from '@contract/import-range.ts';

/** A day or a week a detail screen can be opened for; a month is the global filter's. */
export type LinkPeriod = Exclude<DetailPeriod, { kind: 'month' }>;

/** A detail route's period in its query: `day=YYYY-MM-DD` or `week=<its Monday>`. */
export type PeriodQuery = { day?: string; week?: string };

export function periodQuery(period?: LinkPeriod): PeriodQuery {
  if (period?.kind === 'day') return { day: period.date };
  if (period?.kind === 'week') return { week: period.from };
  return {};
}

const date = (v: unknown): string | null => (typeof v === 'string' && isIsoDate(v) ? v : null);

/** The day or the week a route's query asks for; null — none or not a real date (main checks the days themselves). */
export function periodRequest(query: Readonly<Record<string, unknown>>): LinkPeriod | null {
  const day = date(query.day);
  if (day !== null) return { kind: 'day', date: day };
  const week = date(query.week);
  return week !== null ? { kind: 'week', from: week } : null;
}
