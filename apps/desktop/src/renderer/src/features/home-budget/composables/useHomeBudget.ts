import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { useMoneyFormat } from '@/entities/currency-display';
import { useParticipantStore } from '@/entities/participant';
import { useMonthStore } from '@/entities/period';
import { useSyncStatusStore } from '@/entities/sync-status';
import { budgetLink } from '@/shared/config';
import { useAsyncData } from '@/shared/lib';
import { useHomeBudgetRequest } from '../api/useHomeBudgetRequest.ts';
import type { UseHomeBudgetReturn } from '../types.ts';
import { attentionLimits, budgetRow } from '../utils.ts';

/**
 * Home's budget: the «Budget» row and the «Limits» slide from one read (the «Budget» screen's, kept and shared), for
 * the home month and person; quiet reloads on new data.
 */
export function useHomeBudget(): UseHomeBudgetReturn {
  const api = useHomeBudgetRequest();
  const syncStatus = useSyncStatusStore();
  const participant = useParticipantStore();
  const { month } = storeToRefs(useMonthStore());
  const participantId = () => participant.selectedId;
  const query = () => {
    const id = participantId();
    return { month: month.value, ...(id !== null ? { participantId: id } : {}) };
  };
  const { state } = useAsyncData(() => api.fetchLimits(query()), [month, participantId], {
    quiet: [() => syncStatus.version],
    cached: () => api.peekLimits(query()),
  });
  const fmt = useMoneyFormat(() => state.value.data?.rates);
  const attention = computed(() => (state.value.data?.current ? attentionLimits(state.value.data, fmt.value) : []));
  return {
    row: computed(() => {
      const v = state.value.data;
      return v?.budget ? budgetRow(v.budget, v.month, v.current, fmt.value) : null;
    }),
    empty: computed(() => state.value.data?.current === true && state.value.data.budget === null),
    attention,
    anyExceeded: computed(() => attention.value.some((l) => l.look.state === 'exceeded')),
    budgetTo: budgetLink(),
    setTo: budgetLink(true),
  };
}
