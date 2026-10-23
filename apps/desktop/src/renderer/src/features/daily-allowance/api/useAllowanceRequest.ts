import type { ReserveInput } from '@contract/allowance.ts';
import type { AllowanceOverview, AllowanceQuery } from '@contract/api.ts';
import { balanceApi } from '@/shared/api';
import { readCache, readKey } from '@/shared/lib';

export function useAllowanceRequest(): {
  fetchAllowance: (q: AllowanceQuery) => Promise<AllowanceOverview>;
  /** The kept answer to the same query (readCache), if any. */
  peekAllowance: (q: AllowanceQuery) => { data: AllowanceOverview; fresh: boolean } | null;
  addReserve: (r: ReserveInput) => Promise<void>;
  updateReserve: (id: number, r: ReserveInput) => Promise<void>;
  deleteReserve: (id: number) => Promise<void>;
} {
  return {
    fetchAllowance: (q) => balanceApi.getAllowanceOverview(q),
    peekAllowance: (q) => readCache.peek<AllowanceOverview>(readKey('getAllowanceOverview', [q])),
    addReserve: (r) => balanceApi.addReserve(r),
    updateReserve: (id, r) => balanceApi.updateReserve(id, r),
    deleteReserve: (id) => balanceApi.deleteReserve(id),
  };
}
