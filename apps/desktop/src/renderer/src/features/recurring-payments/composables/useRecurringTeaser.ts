import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { useMoneyFormat } from '@/entities/currency-display';
import { useParticipantStore } from '@/entities/participant';
import { useMonthStore } from '@/entities/period';
import { useSyncStatusStore } from '@/entities/sync-status';
import { useAsyncData } from '@/shared/lib';
import { useRecurringRequest } from '../api/useRecurringRequest.ts';
import type { RecurringTeaserView, UseRecurringTeaserReturn } from '../types.ts';
import { teaserView } from '../utils.ts';

/**
 * The regular payments line of home: the global filter's person (or the family), only while the month filter is this
 * month (it is about now). Reloads quietly on new data; a mark set on the regular payments screen is a write, so back
 * on home the kept answer is stale and reloads quietly.
 */
export function useRecurringTeaser(): UseRecurringTeaserReturn {
  const { fetchRecurringOverview, peekRecurringOverview } = useRecurringRequest();
  const syncStatus = useSyncStatusStore();
  const participant = useParticipantStore();
  const { month, thisMonth } = storeToRefs(useMonthStore());
  const participantId = () => participant.selectedId;
  // The same query for the request and for the kept answer.
  const query = () => {
    const id = participantId();
    return { ...(id !== null ? { participantId: id } : {}), ...participant.banksQuery() };
  };
  const { state } = useAsyncData(
    () => fetchRecurringOverview(query()),
    [participantId, () => participant.banksKey],
    { quiet: [() => syncStatus.version], cached: () => peekRecurringOverview(query()) },
  );
  const fmt = useMoneyFormat(() => state.value.data?.rates);
  return {
    view: computed<RecurringTeaserView | null>(() => {
      const v = state.value.data;
      return month.value === thisMonth.value && v && v.active.length > 0 ? teaserView(v, fmt.value) : null;
    }),
  };
}
