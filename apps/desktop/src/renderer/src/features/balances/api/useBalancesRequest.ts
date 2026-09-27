import type { MonthOverview, MonthOverviewQuery } from '@contract/api.ts';
import { balanceApi } from '@/shared/api';

export function useBalancesRequest(): { fetchOverview: (q: MonthOverviewQuery) => Promise<MonthOverview> } {
  return { fetchOverview: (q) => balanceApi.getMonthOverview(q) };
}
