import type { AllowanceOverview, AllowanceQuery, AnalyticsOverview, AnalyticsQuery } from '@contract/api.ts';
import { balanceApi } from '@/shared/api';

/** The month pace's data: one month of the analytics answer (day buckets, usual) and «Available per day». */
export function usePaceRequest(): {
  fetchAnalytics: (q: AnalyticsQuery) => Promise<AnalyticsOverview>;
  fetchAllowance: (q: AllowanceQuery) => Promise<AllowanceOverview>;
} {
  return {
    fetchAnalytics: (q) => balanceApi.getAnalyticsOverview(q),
    fetchAllowance: (q) => balanceApi.getAllowanceOverview(q),
  };
}
