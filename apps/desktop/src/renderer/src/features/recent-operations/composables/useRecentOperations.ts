import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { useMoneyFormat } from '@/entities/currency-display';
import { useMonthStore } from '@/entities/period';
import { useParticipantStore } from '@/entities/participant';
import { useScopeStore } from '@/entities/scope';
import { useSyncStatusStore } from '@/entities/sync-status';
import { useAsyncData } from '@/shared/lib';
import { useRecentRequest } from '../api/useRecentRequest.ts';
import type { UseRecentOperationsReturn } from '../types.ts';
import { recentRows } from '../utils.ts';

/**
 * Home's «Recent operations»: the month's newest operations for the home's person, banks and scope; reloads when any
 * changes, and quietly when the data changes.
 */
export function useRecentOperations(): UseRecentOperationsReturn {
  const { fetchRecentOperations, peekRecentOperations } = useRecentRequest();
  const syncStatus = useSyncStatusStore();
  const participant = useParticipantStore();
  const { month } = storeToRefs(useMonthStore());
  const { scope } = storeToRefs(useScopeStore());
  const fmt = useMoneyFormat(() => undefined);

  const participantId = () => participant.selectedId;
  const query = () => {
    const id = participantId();
    return { month: month.value, scope: scope.value, ...(id !== null ? { participantId: id } : {}), ...participant.banksQuery() };
  };
  const { state } = useAsyncData(
    () => fetchRecentOperations(query()),
    [month, scope, participantId, () => participant.banksKey],
    { quiet: [() => syncStatus.version], cached: () => peekRecentOperations(query()) },
  );

  return {
    rows: computed(() => (state.value.data ? recentRows(state.value.data, fmt.value, scope.value) : [])),
    loaded: computed(() => !!state.value.data),
  };
}
