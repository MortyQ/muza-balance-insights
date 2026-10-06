import type { NowOverview, NowOverviewQuery } from '@contract/api.ts';
import { balanceApi } from '@/shared/api';

export function useNowRequest(): { fetchNowOverview: (q: NowOverviewQuery) => Promise<NowOverview> } {
  return { fetchNowOverview: (q) => balanceApi.getNowOverview(q) };
}
