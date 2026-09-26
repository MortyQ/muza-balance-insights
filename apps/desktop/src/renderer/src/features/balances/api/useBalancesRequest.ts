import type { BalancesQuery, BalancesView } from '@contract/api.ts';
import { balanceApi } from '@/shared/api';

export function useBalancesRequest(): { fetchBalances: (q: BalancesQuery) => Promise<BalancesView> } {
  return { fetchBalances: (q) => balanceApi.getBalances(q) };
}
