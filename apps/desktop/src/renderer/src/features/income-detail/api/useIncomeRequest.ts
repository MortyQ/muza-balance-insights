import type { IncomeOverview, IncomeOverviewQuery } from '@contract/api.ts';
import { balanceApi } from '@/shared/api';

export function useIncomeRequest(): { fetchIncomeOverview: (q: IncomeOverviewQuery) => Promise<IncomeOverview> } {
  return { fetchIncomeOverview: (q) => balanceApi.getIncomeOverview(q) };
}
