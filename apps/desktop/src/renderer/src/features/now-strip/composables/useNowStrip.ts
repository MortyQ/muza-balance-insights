import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { useMoneyFormat } from '@/entities/currency-display';
import { useParticipantStore } from '@/entities/participant';
import { useMonthStore } from '@/entities/period';
import { useSyncStatusStore } from '@/entities/sync-status';
import { useAsyncData } from '@/shared/lib';
import { useNowRequest } from '../api/useNowRequest.ts';
import type { UseNowStripReturn } from '../types.ts';
import { nowView } from '../utils.ts';

/**
 * Today and this week for the global filter's person (or the family): reloads with the person, quietly on new data
 * and on a new local day; shown only while the month filter is this month (the strip is always about now).
 */
export function useNowStrip(): UseNowStripReturn {
  const { fetchNowOverview, peekNowOverview } = useNowRequest();
  const syncStatus = useSyncStatusStore();
  const participant = useParticipantStore();
  const { month, thisMonth, today } = storeToRefs(useMonthStore());

  const participantId = () => participant.selectedId;
  // The same query for the request and for the kept answer.
  const query = () => {
    const id = participantId();
    return id !== null ? { participantId: id } : {};
  };
  const { state } = useAsyncData(
    () => fetchNowOverview(query()),
    [participantId],
    { quiet: [() => syncStatus.version, today], cached: () => peekNowOverview(query()) },
  );

  const fmt = useMoneyFormat(() => state.value.data?.rates);
  const view = computed(() => (state.value.data ? nowView(state.value.data, fmt.value) : null));
  return { visible: computed(() => month.value === thisMonth.value && view.value !== null), view };
}
