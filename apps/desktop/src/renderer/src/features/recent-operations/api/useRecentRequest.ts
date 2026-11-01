import type { RecentOperations, SpendingOverviewQuery } from '@contract/api.ts';
import { balanceApi } from '@/shared/api';
import { readCache, readKey } from '@/shared/lib';

export function useRecentRequest(): {
  fetchRecentOperations: (q: SpendingOverviewQuery) => Promise<RecentOperations>;
  /** The kept answer to the same query (readCache), if any. */
  peekRecentOperations: (q: SpendingOverviewQuery) => { data: RecentOperations; fresh: boolean } | null;
} {
  return {
    fetchRecentOperations: (q) => balanceApi.getRecentOperations(q),
    peekRecentOperations: (q) => readCache.peek<RecentOperations>(readKey('getRecentOperations', [q])),
  };
}
