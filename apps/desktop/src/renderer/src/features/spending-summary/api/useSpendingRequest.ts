import type { SpendingOverview, SpendingOverviewQuery } from '@contract/api.ts';
import { balanceApi } from '@/shared/api';

export function useSpendingRequest(): { fetchSpendingOverview: (q: SpendingOverviewQuery) => Promise<SpendingOverview> } {
  return { fetchSpendingOverview: (q) => balanceApi.getSpendingOverview(q) };
}
