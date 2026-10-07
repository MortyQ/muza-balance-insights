import { computed, toValue, type MaybeRefOrGetter } from 'vue';
import type { DetailPeriod } from '@contract/api.ts';
import { useMoneyFormat } from '@/entities/currency-display';
import { useParticipantStore } from '@/entities/participant';
import { useSyncStatusStore } from '@/entities/sync-status';
import { t, useAsyncData } from '@/shared/lib';
import { useIncomeRequest } from '../api/useIncomeRequest.ts';
import type { UseIncomeDetailReturn } from '../types.ts';

/**
 * The income of a period (a day, a week, a month) for the global filter's person (or the family): reloads when either
 * changes, and quietly when the data changes.
 */
export function useIncomeDetail(period: MaybeRefOrGetter<DetailPeriod>): UseIncomeDetailReturn {
  const { fetchIncomeOverview } = useIncomeRequest();
  const syncStatus = useSyncStatusStore();
  const participant = useParticipantStore();

  const participantId = () => participant.selectedId;
  const { state } = useAsyncData(
    () => {
      const id = participantId();
      return fetchIncomeOverview({ period: toValue(period), ...(id !== null ? { participantId: id } : {}) });
    },
    // The period by value: a page that rebuilds the same period does not reload.
    [() => JSON.stringify(toValue(period)), participantId],
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
