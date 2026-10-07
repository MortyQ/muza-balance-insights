import type { AllowanceReserve } from '@contract/allowance.ts';
import type { AllowanceOverview, AllowanceQuery } from '@contract/api.ts';
import { balanceApi } from '@/shared/api';

export function useAllowanceRequest(): {
  fetchAllowance: (q: AllowanceQuery) => Promise<AllowanceOverview>;
  saveReserve: (r: AllowanceReserve) => Promise<AllowanceReserve>;
} {
  return { fetchAllowance: (q) => balanceApi.getAllowanceOverview(q), saveReserve: (r) => balanceApi.setAllowanceReserve(r) };
}
