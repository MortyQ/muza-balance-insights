import type { CategoryOverview, CategoryOverviewQuery } from '@contract/api.ts';
import { balanceApi } from '@/shared/api';
import { readCache, readKey } from '@/shared/lib';

export function useCategoryRequest(): {
  fetchCategoryOverview: (q: CategoryOverviewQuery) => Promise<CategoryOverview>;
  /** The kept answer to the same query (readCache), if any. */
  peekCategoryOverview: (q: CategoryOverviewQuery) => { data: CategoryOverview; fresh: boolean } | null;
} {
  return {
    fetchCategoryOverview: (q) => balanceApi.getCategoryOverview(q),
    peekCategoryOverview: (q) => readCache.peek<CategoryOverview>(readKey('getCategoryOverview', [q])),
  };
}
