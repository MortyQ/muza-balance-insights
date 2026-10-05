import type { CategoryOverview, CategoryOverviewQuery } from '@contract/api.ts';
import { balanceApi } from '@/shared/api';

export function useCategoryRequest(): { fetchCategoryOverview: (q: CategoryOverviewQuery) => Promise<CategoryOverview> } {
  return { fetchCategoryOverview: (q) => balanceApi.getCategoryOverview(q) };
}
