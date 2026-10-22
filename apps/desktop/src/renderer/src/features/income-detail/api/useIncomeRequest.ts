import type { IncomeOverview, IncomeOverviewQuery } from '@contract/api.ts';
import { balanceApi } from '@/shared/api';
import { readCache, readKey } from '@/shared/lib';

export function useIncomeRequest(): {
  fetchIncomeOverview: (q: IncomeOverviewQuery) => Promise<IncomeOverview>;
  /** The kept answer to the same query (readCache), if any. */
  peekIncomeOverview: (q: IncomeOverviewQuery) => { data: IncomeOverview; fresh: boolean } | null;
} {
  return {
    fetchIncomeOverview: (q) => balanceApi.getIncomeOverview(q),
    peekIncomeOverview: (q) => readCache.peek<IncomeOverview>(readKey('getIncomeOverview', [q])),
  };
}
