import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { useCurrencyDisplayStore } from '@/entities/currency-display';
import { useParticipantStore } from '@/entities/participant';
import { useMonthStore } from '@/entities/period';
import { useSyncStatusStore } from '@/entities/sync-status';
import { useAsyncData } from '@/shared/lib';
import { useNowRequest } from '../api/useNowRequest.ts';
import type { UseNowStripReturn } from '../types.ts';
import { nowView } from '../utils.ts';

/**
 * Today and this week for the global filter's person (or the family): reloads with the person, quietly on new data
 * and on a new Kyiv day; shown only while the month filter is this month (the strip is always about now).
 */
export function useNowStrip(): UseNowStripReturn {
  const { fetchNowOverview } = useNowRequest();
  const syncStatus = useSyncStatusStore();
  const participant = useParticipantStore();
  const currency = useCurrencyDisplayStore();
  const { month, thisMonth, today } = storeToRefs(useMonthStore());

  const participantId = () => participant.selectedId;
  const { state } = useAsyncData(
    () => {
      const id = participantId();
      return fetchNowOverview(id !== null ? { participantId: id } : {});
    },
    [participantId],
    { quiet: [() => syncStatus.version, today] },
  );

  const view = computed(() => (state.value.data ? nowView(state.value.data, currency.prefs) : null));
  return { visible: computed(() => month.value === thisMonth.value && view.value !== null), view };
}
