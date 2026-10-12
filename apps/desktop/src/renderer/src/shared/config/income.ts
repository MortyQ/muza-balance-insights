import { type LinkPeriod, periodQuery, type PeriodQuery } from './period.ts';
import { ROUTE } from './routes.ts';

/** A link to the income screen; `period` — a day or a week (absent — the global filter's month). */
export function incomeLink(period?: LinkPeriod): { name: typeof ROUTE.income; query: PeriodQuery } {
  return { name: ROUTE.income, query: periodQuery(period) };
}
