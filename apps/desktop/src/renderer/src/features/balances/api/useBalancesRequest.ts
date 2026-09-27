import type { MonthOverview, MonthOverviewQuery } from '@contract/api.ts';
import { balanceApi } from '@/shared/api';

export function useBalancesRequest(): { fetchMonthOverview: (q: MonthOverviewQuery) => Promise<MonthOverview> } {
  return { fetchMonthOverview: (q) => balanceApi.getMonthOverview(q) };
}
