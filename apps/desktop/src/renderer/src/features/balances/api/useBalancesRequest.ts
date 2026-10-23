import type { MonthOverview, MonthOverviewQuery } from '@contract/api.ts';
import { balanceApi } from '@/shared/api';
import { readCache, readKey } from '@/shared/lib';

export function useBalancesRequest(): {
  fetchOverview: (q: MonthOverviewQuery) => Promise<MonthOverview>;
  /** The kept answer to the same query (readCache), if any. */
  peekOverview: (q: MonthOverviewQuery) => { data: MonthOverview; fresh: boolean } | null;
} {
  return {
    fetchOverview: (q) => balanceApi.getMonthOverview(q),
    peekOverview: (q) => readCache.peek<MonthOverview>(readKey('getMonthOverview', [q])),
  };
}
