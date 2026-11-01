import type { LimitsOverview, LimitsOverviewQuery } from '@contract/api.ts';
import { balanceApi } from '@/shared/api';
import { readCache, readKey } from '@/shared/lib';

export function useHomeBudgetRequest(): {
  fetchLimits: (q: LimitsOverviewQuery) => Promise<LimitsOverview>;
  /** The kept answer to the same query (readCache, shared with the «Budget» screen), if any. */
  peekLimits: (q: LimitsOverviewQuery) => { data: LimitsOverview; fresh: boolean } | null;
} {
  return {
    fetchLimits: (q) => balanceApi.getLimitsOverview(q),
    peekLimits: (q) => readCache.peek<LimitsOverview>(readKey('getLimitsOverview', [q])),
  };
}
