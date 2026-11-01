import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import type { RecentOperations } from '@contract/api.ts';
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
 * changes, and quietly when the data changes. Only for the current month: a past month asks nothing and has no rows.
 */
export function useRecentOperations(): UseRecentOperationsReturn {
  const { fetchRecentOperations, peekRecentOperations } = useRecentRequest();
  const syncStatus = useSyncStatusStore();
  const participant = useParticipantStore();
  const { month, thisMonth } = storeToRefs(useMonthStore());
  const { scope } = storeToRefs(useScopeStore());

  const participantId = () => participant.selectedId;
  const query = () => {
    const id = participantId();
    return { month: month.value, scope: scope.value, ...(id !== null ? { participantId: id } : {}), ...participant.banksQuery() };
  };
  const current = () => month.value === thisMonth.value;
  const { state } = useAsyncData<RecentOperations | null>(
    () => (current() ? fetchRecentOperations(query()) : Promise.resolve(null)),
    [month, thisMonth, scope, participantId, () => participant.banksKey],
    { quiet: [() => syncStatus.version], cached: () => (current() ? peekRecentOperations(query()) : null) },
  );
  const fmt = useMoneyFormat(() => state.value.data?.rates);

  return {
    rows: computed(() => (state.value.data ? recentRows(state.value.data, fmt.value, scope.value) : [])),
    loaded: computed(() => state.value.status === 'success'),
  };
}
