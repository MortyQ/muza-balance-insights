import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import type { GoalCurrency, GoalPayload } from '@contract/api.ts';
import { useCurrencyDisplayStore, useMoneyFormat } from '@/entities/currency-display';
import { useParticipantStore } from '@/entities/participant';
import { useMonthStore } from '@/entities/period';
import { useSyncStatusStore } from '@/entities/sync-status';
import { t, useAsyncData } from '@/shared/lib';
import { useLimitsRequest } from '../api/useLimitsRequest.ts';
import type { UseLimitsGoalsReturn } from '../types.ts';
import { limitsScreenView } from '../utils.ts';

/**
 * The «Budget» screen for the global filters' month and person: reloads with them, quietly on new data; a write
 * refreshes the data status, so home's budget row and the other screens reload quietly too.
 */
export function useLimitsGoals(): UseLimitsGoalsReturn {
  const api = useLimitsRequest();
  const syncStatus = useSyncStatusStore();
  const participant = useParticipantStore();
  const currencies = useCurrencyDisplayStore();
  const { month } = storeToRefs(useMonthStore());

  const participantId = () => participant.selectedId;
  const query = () => {
    const id = participantId();
    return { month: month.value, ...(id !== null ? { participantId: id } : {}) };
  };
  const { state, reload } = useAsyncData(() => api.fetchLimits(query()), [month, participantId], {
    quiet: [() => syncStatus.version],
    cached: () => api.peekLimits(query()),
  });
  const fmt = useMoneyFormat(() => state.value.data?.rates);

  // Whose a plan is: said wherever there are several people (the family's, or a person's by name).
  const ownerName = (id: number | null) => {
    if (!participant.multiple) return null;
    if (id === null) return t('limits.owner.family');
    return participant.people.find((p) => p.id === id)?.label ?? null;
  };

  async function done(call: () => Promise<void>): Promise<boolean> {
    try {
      await call();
    } catch {
      return false;
    }
    await syncStatus.refresh();
    await reload();
    return true;
  }

  return {
    state,
    view: computed(() => (state.value.data ? limitsScreenView(state.value.data, fmt.value, ownerName) : null)),
    fmt,
    owners: computed(() => (participant.multiple ? participant.people.map((p) => ({ id: p.id, name: p.label })) : [])),
    defaultOwner: computed(() => participant.selectedId),
    defaultCurrency: computed<GoalCurrency>(() => currencies.choice.main),
    save: (id: number | null, g: GoalPayload) => done(() => api.saveGoal(id, g)),
    remove: (id: number) => done(() => api.deleteGoal(id)),
    addSuggested: () => done(() => api.addSuggested(participantId() !== null ? { participantId: participantId()! } : {})),
  };
}
