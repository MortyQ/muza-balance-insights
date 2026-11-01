import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { useMoneyFormat } from '@/entities/currency-display';
import { useMonthStore } from '@/entities/period';
import { useParticipantStore } from '@/entities/participant';
import { useScopeStore } from '@/entities/scope';
import { useSyncStatusStore } from '@/entities/sync-status';
import { useAsyncData } from '@/shared/lib';
import { useHomeInsightsRequest } from '../api/useHomeInsightsRequest.ts';
import type { UseHomeInsightsReturn } from '../types.ts';
import { homeInsightsView } from '../utils.ts';

/**
 * Home's «Insights» block for the home's month, person, banks and «Personal / Business»: reloads when any changes, and
 * quietly when the data changes. `visible` tells the page whether «Spending» shares its row.
 */
export function useHomeInsights(): UseHomeInsightsReturn {
  const { fetchSpendingOverview, peekSpendingOverview } = useHomeInsightsRequest();
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
    () => fetchSpendingOverview(query()),
    [month, scope, participantId, () => participant.banksKey],
    { quiet: [() => syncStatus.version], cached: () => peekSpendingOverview(query()) },
  );

  const view = computed(() => (state.value.data ? homeInsightsView(state.value.data, fmt.value, scope.value) : null));
  return { view, visible: computed(() => view.value !== null) };
}
