import type { AnalyticsOverview, AnalyticsQuery } from '@contract/api.ts';
import { balanceApi } from '@/shared/api';

export function useAnalyticsRequest(): { fetchAnalyticsOverview: (q: AnalyticsQuery) => Promise<AnalyticsOverview> } {
  return { fetchAnalyticsOverview: (q) => balanceApi.getAnalyticsOverview(q) };
}
