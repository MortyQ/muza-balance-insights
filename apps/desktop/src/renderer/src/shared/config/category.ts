import type { Scope } from '@contract/api.ts';
import { CATEGORY_IDS, type CategoryId } from '@contract/categories.ts';
import { ROUTE } from './routes.ts';

/** A link to one category's screen; `scope` — the spending block's switch at the moment of the click. */
export function categoryLink(id: CategoryId, scope: Scope): { name: typeof ROUTE.category; params: { id: CategoryId }; query: { scope: Scope } } {
  return { name: ROUTE.category, params: { id }, query: { scope } };
}

export const isCategoryId = (v: unknown): v is CategoryId => CATEGORY_IDS.some((c) => c === v);

/** What a category route asks for: the category (null — unknown) and the scope (anything but «business» — personal). */
export function categoryRequest(params: Readonly<Record<string, unknown>>, query: Readonly<Record<string, unknown>>): { id: CategoryId | null; scope: Scope } {
  return { id: isCategoryId(params.id) ? params.id : null, scope: query.scope === 'business' ? 'business' : 'personal' };
}
