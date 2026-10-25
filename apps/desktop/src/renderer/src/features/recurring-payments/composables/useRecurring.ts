import { computed, ref } from 'vue';
import type { RecurringMark } from '@contract/api.ts';
import { useMoneyFormat } from '@/entities/currency-display';
import { useParticipantStore } from '@/entities/participant';
import { useSyncStatusStore } from '@/entities/sync-status';
import { useAsyncData } from '@/shared/lib';
import { useRecurringRequest } from '../api/useRecurringRequest.ts';
import type { UseRecurringReturn } from '../types.ts';

/** Regular payments of the global filter's person (or the family): reloads when it changes, quietly when the data does. */
export function useRecurring(): UseRecurringReturn {
  const { fetchRecurringOverview, peekRecurringOverview, saveRecurringMark } = useRecurringRequest();
  const syncStatus = useSyncStatusStore();
  const participant = useParticipantStore();

  const participantId = () => participant.selectedId;
  // The same query for the request and for the kept answer.
  const query = () => {
    const id = participantId();
    return id !== null ? { participantId: id } : {};
  };
  const { state, reload } = useAsyncData(
    () => fetchRecurringOverview(query()),
    [participantId],
    { quiet: [() => syncStatus.version], cached: () => peekRecurringOverview(query()) },
  );
  // Also publishes the answer's rates to the currency button of the global filters.
  const fmt = useMoneyFormat(() => state.value.data?.rates);

  const markFailed = ref(false);
  async function setMark(key: string, mark: RecurringMark | null): Promise<void> {
    markFailed.value = false;
    try {
      await saveRecurringMark({ key, mark });
    } catch {
      markFailed.value = true;
      return;
    }
    await reload();
  }
  return { state, view: computed(() => state.value.data), fmt, setMark, markFailed };
}
