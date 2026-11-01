import type { InsightsOverview, SpendingOverviewQuery } from '@contract/api.ts';
import { balanceApi } from '@/shared/api';
import { readCache, readKey } from '@/shared/lib';

export function useInsightsRequest(): {
  fetchInsightsOverview: (q: SpendingOverviewQuery) => Promise<InsightsOverview>;
  /** The kept answer to the same query (readCache), if any. */
  peekInsightsOverview: (q: SpendingOverviewQuery) => { data: InsightsOverview; fresh: boolean } | null;
} {
  return {
    fetchInsightsOverview: (q) => balanceApi.getInsightsOverview(q),
    peekInsightsOverview: (q) => readCache.peek<InsightsOverview>(readKey('getInsightsOverview', [q])),
  };
}
