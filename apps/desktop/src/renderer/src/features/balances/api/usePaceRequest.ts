import type { AnalyticsOverview, AnalyticsQuery } from '@contract/api.ts';
import { balanceApi } from '@/shared/api';

/** The month pace's data: one month of the analytics answer (day buckets, usual). */
export function usePaceRequest(): {
  fetchAnalytics: (q: AnalyticsQuery) => Promise<AnalyticsOverview>;
} {
  return {
    fetchAnalytics: (q) => balanceApi.getAnalyticsOverview(q),
  };
}
