import type { CategoryOverview, CategoryOverviewQuery, LimitsOverview, LimitsOverviewQuery, OperationCategoryQuery, OperationCategoryResult } from '@contract/api.ts';
import { balanceApi } from '@/shared/api';
import { readCache, readKey } from '@/shared/lib';

export function useCategoryRequest(): {
  fetchCategoryOverview: (q: CategoryOverviewQuery) => Promise<CategoryOverview>;
  /** The kept answer to the same query (readCache), if any. */
  peekCategoryOverview: (q: CategoryOverviewQuery) => { data: CategoryOverview; fresh: boolean } | null;
  /** The user's category of a line's debit (a write: every kept answer goes stale). */
  saveOperationCategory: (q: OperationCategoryQuery) => Promise<OperationCategoryResult>;
  /** The view's limits (the «Budget» screen's read, kept and shared): this category's limit bar. */
  fetchLimits: (q: LimitsOverviewQuery) => Promise<LimitsOverview>;
  peekLimits: (q: LimitsOverviewQuery) => { data: LimitsOverview; fresh: boolean } | null;
} {
  return {
    fetchCategoryOverview: (q) => balanceApi.getCategoryOverview(q),
    peekCategoryOverview: (q) => readCache.peek<CategoryOverview>(readKey('getCategoryOverview', [q])),
    saveOperationCategory: (q) => balanceApi.setOperationCategory(q),
    fetchLimits: (q) => balanceApi.getLimitsOverview(q),
    peekLimits: (q) => readCache.peek<LimitsOverview>(readKey('getLimitsOverview', [q])),
  };
}
