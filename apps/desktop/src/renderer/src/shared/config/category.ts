import type { DetailPeriod, Scope } from '@contract/api.ts';
import { CATEGORY_IDS, type CategoryId } from '@contract/categories.ts';
import { isIsoDate } from '@contract/import-range.ts';
import { ROUTE } from './routes.ts';

/** A day or a week the category screen can be opened for; a month is the global filter's. */
export type LinkPeriod = Exclude<DetailPeriod, { kind: 'month' }>;

type CategoryLink = {
  name: typeof ROUTE.category;
  params: { id: CategoryId };
  query: { scope: Scope; day?: string; week?: string };
};

/**
 * A link to one category's screen; `scope` — the spending block's switch at the moment of the click; `period` — a day or
 * a week (absent — the global filter's month).
 */
export function categoryLink(id: CategoryId, scope: Scope, period?: LinkPeriod): CategoryLink {
  const query: CategoryLink['query'] = { scope };
  if (period?.kind === 'day') query.day = period.date;
  if (period?.kind === 'week') query.week = period.from;
  return { name: ROUTE.category, params: { id }, query };
}

export const isCategoryId = (v: unknown): v is CategoryId => CATEGORY_IDS.some((c) => c === v);

const date = (v: unknown): string | null => (typeof v === 'string' && isIsoDate(v) ? v : null);

/**
 * What a category route asks for: the category (null — unknown), the scope (anything but «business» — personal) and a
 * day or a week (null — the global filter's month; main checks the days themselves).
 */
export function categoryRequest(
  params: Readonly<Record<string, unknown>>,
  query: Readonly<Record<string, unknown>>,
): { id: CategoryId | null; scope: Scope; period: LinkPeriod | null } {
  const day = date(query.day);
  const week = date(query.week);
  return {
    id: isCategoryId(params.id) ? params.id : null,
    scope: query.scope === 'business' ? 'business' : 'personal',
    period: day !== null ? { kind: 'day', date: day } : week !== null ? { kind: 'week', from: week } : null,
  };
}
