import type { ReserveInput } from '@contract/allowance.ts';
import type { AllowanceOverview, AllowanceQuery } from '@contract/api.ts';
import { balanceApi } from '@/shared/api';

export function useAllowanceRequest(): {
  fetchAllowance: (q: AllowanceQuery) => Promise<AllowanceOverview>;
  addReserve: (r: ReserveInput) => Promise<void>;
  updateReserve: (id: number, r: ReserveInput) => Promise<void>;
  deleteReserve: (id: number) => Promise<void>;
} {
  return {
    fetchAllowance: (q) => balanceApi.getAllowanceOverview(q),
    addReserve: (r) => balanceApi.addReserve(r),
    updateReserve: (id, r) => balanceApi.updateReserve(id, r),
    deleteReserve: (id) => balanceApi.deleteReserve(id),
  };
}
