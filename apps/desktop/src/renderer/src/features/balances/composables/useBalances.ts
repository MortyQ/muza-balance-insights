import type { BalancesView } from '@contract/api.ts';
import { useSyncStatusStore } from '@/entities/sync-status';
import { useAsyncData, type UseAsyncDataReturn } from '@/shared/lib';
import { useBalancesRequest } from '../api/useBalancesRequest.ts';

/** Balances; reloaded whenever the data changes (sync-status version). */
export function useBalances(): UseAsyncDataReturn<BalancesView> {
  const { fetchBalances } = useBalancesRequest();
  const syncStatus = useSyncStatusStore();
  return useAsyncData(fetchBalances, [() => syncStatus.version]);
}
