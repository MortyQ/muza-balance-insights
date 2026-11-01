import type { SpendingOverview, SpendingOverviewQuery } from '@contract/api.ts';
import { balanceApi } from '@/shared/api';
import { readCache, readKey } from '@/shared/lib';

// The same read as the spending block: the read cache and the in-flight sharing answer both with one request.
export function useHomeInsightsRequest(): {
  fetchSpendingOverview: (q: SpendingOverviewQuery) => Promise<SpendingOverview>;
  /** The kept answer to the same query (readCache), if any. */
  peekSpendingOverview: (q: SpendingOverviewQuery) => { data: SpendingOverview; fresh: boolean } | null;
} {
  return {
    fetchSpendingOverview: (q) => balanceApi.getSpendingOverview(q),
    peekSpendingOverview: (q) => readCache.peek<SpendingOverview>(readKey('getSpendingOverview', [q])),
  };
}
