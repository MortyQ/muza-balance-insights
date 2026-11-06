import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { useMoneyFormat } from '@/entities/currency-display';
import { useMonthStore } from '@/entities/period';
import { useParticipantStore } from '@/entities/participant';
import { useScopeStore } from '@/entities/scope';
import { useSyncStatusStore } from '@/entities/sync-status';
import { useAsyncData } from '@/shared/lib';
import { useInsightsRequest } from '../api/useInsightsRequest.ts';
import type { UseInsightsPageReturn } from '../types.ts';
import { insightsPageView } from '../utils/index.ts';

/**
 * The Insights screen for the global month, person, banks and «Personal / Business»: reloads when any changes, quietly
 * when the data changes.
 */
export function useInsightsPage(): UseInsightsPageReturn {
  const { fetchInsightsOverview, peekInsightsOverview } = useInsightsRequest();
  const syncStatus = useSyncStatusStore();
  const participant = useParticipantStore();
  const { month, thisMonth } = storeToRefs(useMonthStore());
  const { scope } = storeToRefs(useScopeStore());

  const participantId = () => participant.selectedId;
  const query = () => {
    const id = participantId();
    return { month: month.value, scope: scope.value, ...(id !== null ? { participantId: id } : {}), ...participant.banksQuery() };
  };
  const { state } = useAsyncData(
    () => fetchInsightsOverview(query()),
    [month, scope, participantId, () => participant.banksKey],
    { quiet: [() => syncStatus.version], cached: () => peekInsightsOverview(query()) },
  );
  const fmt = useMoneyFormat(() => state.value.data?.rates);

  const view = computed(() =>
    state.value.data ? insightsPageView(state.value.data, fmt.value, scope.value, Number(thisMonth.value.slice(0, 4))) : null,
  );
  return { state, view, fmt };
}
