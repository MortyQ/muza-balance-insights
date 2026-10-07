import { computed } from 'vue';
import { useMoneyFormat } from '@/entities/currency-display';
import { useParticipantStore } from '@/entities/participant';
import { useSyncStatusStore } from '@/entities/sync-status';
import { useAsyncData } from '@/shared/lib';
import { useRecurringRequest } from '../api/useRecurringRequest.ts';
import type { UseRecurringReturn } from '../types.ts';

/** Regular payments of the global filter's person (or the family): reloads when it changes, quietly when the data does. */
export function useRecurring(): UseRecurringReturn {
  const { fetchRecurringOverview } = useRecurringRequest();
  const syncStatus = useSyncStatusStore();
  const participant = useParticipantStore();

  const participantId = () => participant.selectedId;
  const { state } = useAsyncData(
    () => {
      const id = participantId();
      return fetchRecurringOverview(id !== null ? { participantId: id } : {});
    },
    [participantId],
    { quiet: [() => syncStatus.version] },
  );
  // Also publishes the answer's rates to the currency button of the global filters.
  const fmt = useMoneyFormat(() => state.value.data?.rates);
  return { state, view: computed(() => state.value.data), fmt };
}
