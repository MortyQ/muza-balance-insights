import type { SpendingQuery, SpendingView } from '@contract/api.ts';
import { balanceApi } from '@/shared/api';

export function useSpendingRequest(): { fetchSpending: (q: SpendingQuery) => Promise<SpendingView> } {
  return { fetchSpending: (q) => balanceApi.spendingSummary(q) };
}
