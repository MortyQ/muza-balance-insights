import { ROUTE } from './routes.ts';

/** A link to the «All categories» screen (the month, scope and filters are the global ones). */
export function spendingCategoriesLink(): { name: typeof ROUTE.spendingCategories } {
  return { name: ROUTE.spendingCategories };
}
