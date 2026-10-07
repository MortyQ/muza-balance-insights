import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { ALLOWANCE_RESERVE_MAX } from '@contract/allowance.ts';
import { useMoneyFormat } from '@/entities/currency-display';
import { useParticipantStore } from '@/entities/participant';
import { useMonthStore } from '@/entities/period';
import { useSyncStatusStore } from '@/entities/sync-status';
import { useAsyncData } from '@/shared/lib';
import { useAllowanceRequest } from '../api/useAllowanceRequest.ts';
import type { UseAllowanceReturn } from '../types.ts';
import { allowanceView } from '../utils.ts';

/**
 * «Available per day» for the global filter's person (or the family): reloads with the person, quietly on new data and
 * on a new local day; shown only while the month filter is this month (it is always about now).
 */
export function useAllowance(): UseAllowanceReturn {
  const { fetchAllowance, saveReserve } = useAllowanceRequest();
  const syncStatus = useSyncStatusStore();
  const participant = useParticipantStore();
  const { month, thisMonth, today } = storeToRefs(useMonthStore());

  const participantId = () => participant.selectedId;
  const { state, reload } = useAsyncData(
    () => {
      const id = participantId();
      return fetchAllowance(id !== null ? { participantId: id } : {});
    },
    [participantId],
    { quiet: [() => syncStatus.version, today] },
  );

  const fmt = useMoneyFormat(() => state.value.data?.rates);
  const view = computed(() => (state.value.data ? allowanceView(state.value.data, fmt.value, Number(today.value.slice(0, 4))) : null));

  async function setReserve(hryvnias: number): Promise<boolean> {
    const kopecks = hryvnias * 100;
    if (!Number.isInteger(hryvnias) || kopecks < 0 || kopecks > ALLOWANCE_RESERVE_MAX) return false;
    try {
      await saveReserve(kopecks);
    } catch {
      return false;
    }
    await reload();
    return true;
  }

  return {
    state,
    visible: computed(() => month.value === thisMonth.value && view.value !== null),
    view,
    reserve: computed(() => Math.round((state.value.data?.reserve ?? 0) / 100)),
    setReserve,
  };
}
