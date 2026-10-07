import { computed, onActivated, onDeactivated, ref } from 'vue';
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
 * month (it is about now). Reloads quietly on new data and on coming back to home (kept alive), where marks may have
 * changed on the regular payments screen.
 */
export function useRecurringTeaser(): UseRecurringTeaserReturn {
  const { fetchRecurringOverview } = useRecurringRequest();
  const syncStatus = useSyncStatusStore();
  const participant = useParticipantStore();
  const { month, thisMonth } = storeToRefs(useMonthStore());
  // Activated also fires on the first mount: only a return after leaving reloads.
  const shown = ref(0);
  let away = false;
  onDeactivated(() => (away = true));
  onActivated(() => {
    if (away) shown.value += 1;
  });

  const participantId = () => participant.selectedId;
  const { state } = useAsyncData(
    () => {
      const id = participantId();
      return fetchRecurringOverview(id !== null ? { participantId: id } : {});
    },
    [participantId],
    { quiet: [() => syncStatus.version, shown] },
  );
  const fmt = useMoneyFormat(() => state.value.data?.rates);
  return {
    view: computed<RecurringTeaserView | null>(() => {
      const v = state.value.data;
      return month.value === thisMonth.value && v && v.active.length > 0 ? teaserView(v, fmt.value) : null;
    }),
  };
}
