import type { AllowanceOverview, AllowanceQuery } from '@contract/api.ts';
import { balanceApi } from '@/shared/api';

export function useAllowanceRequest(): {
  fetchAllowance: (q: AllowanceQuery) => Promise<AllowanceOverview>;
  saveReserve: (kopecks: number) => Promise<number>;
} {
  return { fetchAllowance: (q) => balanceApi.getAllowanceOverview(q), saveReserve: (k) => balanceApi.setAllowanceReserve(k) };
}
