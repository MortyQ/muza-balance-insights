import type { AnalyticsOverview, AnalyticsQuery } from '@contract/api.ts';
import { balanceApi } from '@/shared/api';
import { readCache, readKey } from '@/shared/lib';

export function useAnalyticsRequest(): {
  fetchAnalyticsOverview: (q: AnalyticsQuery) => Promise<AnalyticsOverview>;
  /** The kept answer to the same query (readCache), if any. */
  peekAnalyticsOverview: (q: AnalyticsQuery) => { data: AnalyticsOverview; fresh: boolean } | null;
} {
  return {
    fetchAnalyticsOverview: (q) => balanceApi.getAnalyticsOverview(q),
    peekAnalyticsOverview: (q) => readCache.peek<AnalyticsOverview>(readKey('getAnalyticsOverview', [q])),
  };
}
