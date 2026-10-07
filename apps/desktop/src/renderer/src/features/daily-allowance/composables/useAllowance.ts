import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import type { ReserveInput } from '@contract/allowance.ts';
import { useMoneyFormat } from '@/entities/currency-display';
import { colorVar, useParticipantStore } from '@/entities/participant';
import { useMonthStore } from '@/entities/period';
import { useSyncStatusStore } from '@/entities/sync-status';
import { useAsyncData } from '@/shared/lib';
import { useAllowanceRequest } from '../api/useAllowanceRequest.ts';
import type { ReserveRowView, UseAllowanceReturn } from '../types.ts';
import { allowanceView, reserveRows } from '../utils.ts';

/**
 * «Available per day» for the global filter's person (or the family): reloads with the person, quietly on new data and
 * on a new local day. Always about now: the planning screen has no period filter.
 */
export function useAllowance(): UseAllowanceReturn {
  const api = useAllowanceRequest();
  const syncStatus = useSyncStatusStore();
  const participant = useParticipantStore();
  const { today } = storeToRefs(useMonthStore());

  const participantId = () => participant.selectedId;
  const { state, reload } = useAsyncData(
    () => {
      const id = participantId();
      return api.fetchAllowance(id !== null ? { participantId: id } : {});
    },
    [participantId],
    { quiet: [() => syncStatus.version, today] },
  );

  const fmt = useMoneyFormat(() => state.value.data?.rates);
  const year = () => Number(today.value.slice(0, 4));
  const view = computed(() => (state.value.data ? allowanceView(state.value.data, fmt.value, year()) : null));

  // Whose a reserve is, said only in a family view of several people.
  const ownerOf = (id: number | null): ReserveRowView['owner'] => {
    if (!participant.multiple || participant.selectedId !== null) return null;
    if (id === null) return { common: true };
    const p = participant.people.find((x) => x.id === id);
    return p ? { name: p.label, color: colorVar(p.color) } : { common: true };
  };

  async function done(call: () => Promise<void>): Promise<boolean> {
    try {
      await call();
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
    reserves: computed(() => (state.value.data ? reserveRows(state.value.data, fmt.value, year(), ownerOf) : [])),
    owners: computed(() => (participant.multiple ? participant.people.map((p) => ({ id: p.id, name: p.label })) : [])),
    owner: computed(() => participant.selectedId),
    currency: computed(() => fmt.value.currency),
    saveReserve: (id: number | null, r: ReserveInput) => done(() => (id === null ? api.addReserve(r) : api.updateReserve(id, r))),
    deleteReserve: (id: number) => done(() => api.deleteReserve(id)),
  };
}
