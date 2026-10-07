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
import { allowanceView, reserveField } from '../utils.ts';

/**
 * «Available per day» for the global filter's person (or the family): reloads with the person, quietly on new data and
 * on a new local day. Always about now: the planning screen has no period filter.
 */
export function useAllowance(): UseAllowanceReturn {
  const { fetchAllowance, saveReserve } = useAllowanceRequest();
  const syncStatus = useSyncStatusStore();
  const participant = useParticipantStore();
  const { today } = storeToRefs(useMonthStore());

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

  const reserve = computed(() => (state.value.data ? reserveField(state.value.data.reserve, fmt.value) : null));

  async function setReserve(amount: number): Promise<boolean> {
    const field = reserve.value;
    if (!field || !Number.isInteger(amount) || amount < 0 || amount > ALLOWANCE_RESERVE_MAX) return false;
    try {
      await saveReserve({ currency: field.currency, amount });
    } catch {
      return false;
    }
    await reload();
    return true;
  }

  return {
    state,
    visible: computed(() => view.value !== null),
    view,
    reserve,
    setReserve,
  };
}
