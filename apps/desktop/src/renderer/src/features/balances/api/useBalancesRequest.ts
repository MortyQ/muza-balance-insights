import type { BalancesView } from '@contract/api.ts';
import { balanceApi } from '@/shared/api';

export function useBalancesRequest(): { fetchBalances: () => Promise<BalancesView> } {
  return { fetchBalances: () => balanceApi.getBalances() };
}
