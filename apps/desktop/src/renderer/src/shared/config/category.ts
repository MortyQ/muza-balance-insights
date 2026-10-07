import type { Scope } from '@contract/api.ts';
import { CATEGORY_IDS, type CategoryId } from '@contract/categories.ts';
import { type LinkPeriod, periodQuery, type PeriodQuery, periodRequest } from './period.ts';
import { ROUTE } from './routes.ts';

type CategoryLink = { name: typeof ROUTE.category; params: { id: CategoryId }; query: { scope: Scope } & PeriodQuery };

/**
 * A link to one category's screen; `scope` — the spending block's switch at the moment of the click; `period` — a day or
 * a week (absent — the global filter's month).
 */
export function categoryLink(id: CategoryId, scope: Scope, period?: LinkPeriod): CategoryLink {
  return { name: ROUTE.category, params: { id }, query: { scope, ...periodQuery(period) } };
}

export const isCategoryId = (v: unknown): v is CategoryId => CATEGORY_IDS.some((c) => c === v);

/**
 * What a category route asks for: the category (null — unknown), the scope (anything but «business» — personal) and a
 * day or a week (null — the global filter's month).
 */
export function categoryRequest(
  params: Readonly<Record<string, unknown>>,
  query: Readonly<Record<string, unknown>>,
): { id: CategoryId | null; scope: Scope; period: LinkPeriod | null } {
  return {
    id: isCategoryId(params.id) ? params.id : null,
    scope: query.scope === 'business' ? 'business' : 'personal',
    period: periodRequest(query),
  };
}
