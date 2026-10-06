import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { useMoneyFormat } from '@/entities/currency-display';
import { useParticipantStore } from '@/entities/participant';
import { useMonthStore } from '@/entities/period';
import { useSyncStatusStore } from '@/entities/sync-status';
import { t, useAsyncData } from '@/shared/lib';
import { useIncomeRequest } from '../api/useIncomeRequest.ts';
import type { UseIncomeDetailReturn } from '../types.ts';

/** The income of the global filters' month and person (or the family): reloads when either changes, and quietly when the data changes. */
export function useIncomeDetail(): UseIncomeDetailReturn {
  const { fetchIncomeOverview } = useIncomeRequest();
  const syncStatus = useSyncStatusStore();
  const participant = useParticipantStore();
  const { month } = storeToRefs(useMonthStore());

  const participantId = () => participant.selectedId;
  const { state } = useAsyncData(
    () => {
      const id = participantId();
      return fetchIncomeOverview({ month: month.value, ...(id !== null ? { participantId: id } : {}) });
    },
    [month, participantId],
    { quiet: [() => syncStatus.version] },
  );

  // Also publishes the answer's rates to the currency button of the global filters.
  const fmt = useMoneyFormat(() => state.value.data?.rates);
  const family = computed(() => participant.multiple && participant.selectedId === null);
  const who = computed(() => {
    if (family.value) return t('home.spending.whole');
    return participant.multiple ? (participant.people.find((p) => p.id === participant.selectedId)?.label ?? '') : '';
  });

  return { state, view: computed(() => state.value.data), family, who, fmt };
}
