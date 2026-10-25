import type { NowOverview, NowOverviewQuery } from '@contract/api.ts';
import { balanceApi } from '@/shared/api';
import { readCache, readKey } from '@/shared/lib';

export function useNowRequest(): {
  fetchNowOverview: (q: NowOverviewQuery) => Promise<NowOverview>;
  /** The kept answer to the same query (readCache), if any. */
  peekNowOverview: (q: NowOverviewQuery) => { data: NowOverview; fresh: boolean } | null;
} {
  return {
    fetchNowOverview: (q) => balanceApi.getNowOverview(q),
    peekNowOverview: (q) => readCache.peek<NowOverview>(readKey('getNowOverview', [q])),
  };
}
