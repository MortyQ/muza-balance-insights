import type { Scope } from '@contract/api.ts';
import { CATEGORY_IDS, type CategoryId } from '@contract/categories.ts';
import { SEARCH_QUERY_MAX } from '@contract/search.ts';
import { type LinkPeriod, periodQuery, type PeriodQuery, periodRequest } from './period.ts';
import { ROUTE } from './routes.ts';

/** What the category screen's list opens filtered by: its search text (`q`) and its payee filter (`merchant`, a payeeKey). */
export type ListFilter = { q?: string; merchant?: string };

/** Where a category was opened from, when its back link must return there (`from` in the query). */
export type CategoryOrigin = 'categories';

type CategoryLink = {
  name: typeof ROUTE.category;
  params: { id: CategoryId };
  query: { scope: Scope } & PeriodQuery & ListFilter & { from?: CategoryOrigin };
};

/**
 * A link to one category's screen; `scope` — the spending block's switch at the moment of the click; `period` — a day or
 * a week (absent — the global filter's month); `filter` — the list's search or payee (the global search's results);
 * `from` — the screen it was opened from, so the back link returns there (absent — home).
 */
export function categoryLink(id: CategoryId, scope: Scope, period?: LinkPeriod, filter?: ListFilter, from?: CategoryOrigin): CategoryLink {
  const list: ListFilter = {
    ...(filter?.q ? { q: filter.q } : {}),
    ...(filter?.merchant ? { merchant: filter.merchant } : {}),
  };
  return { name: ROUTE.category, params: { id }, query: { scope, ...periodQuery(period), ...list, ...(from ? { from } : {}) } };
}

export const isCategoryId = (v: unknown): v is CategoryId => CATEGORY_IDS.some((c) => c === v);

const origin = (v: unknown): CategoryOrigin | null => (v === 'categories' ? v : null);

const text = (v: unknown): string => (typeof v === 'string' ? v.slice(0, SEARCH_QUERY_MAX) : '');

/**
 * What a category route asks for: the category (null — unknown), the scope (anything but «business» — personal), a
 * day or a week (null — the global filter's month), the list's search and payee filter ('' / null — none) and where it
 * was opened from (null — unknown or absent).
 */
export function categoryRequest(
  params: Readonly<Record<string, unknown>>,
  query: Readonly<Record<string, unknown>>,
): { id: CategoryId | null; scope: Scope; period: LinkPeriod | null; q: string; merchant: string | null; from: CategoryOrigin | null } {
  return {
    id: isCategoryId(params.id) ? params.id : null,
    scope: query.scope === 'business' ? 'business' : 'personal',
    period: periodRequest(query),
    q: text(query.q),
    merchant: text(query.merchant) || null,
    from: origin(query.from),
  };
}
