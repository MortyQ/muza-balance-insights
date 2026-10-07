import { computed, ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import type { Scope } from '@contract/api.ts';
import { useMoneyFormat } from '@/entities/currency-display';
import { useImportProgressStore } from '@/entities/import-progress';
import { useMonthStore } from '@/entities/period';
import { colorVar, useParticipantStore } from '@/entities/participant';
import { useSyncStatusStore } from '@/entities/sync-status';
import { useAsyncData } from '@/shared/lib';
import { useSpendingRequest } from '../api/useSpendingRequest.ts';
import type { BlockPerson, UseSpendingReturn } from '../types.ts';
import { periodNote } from '../utils/index.ts';

/**
 * The spending block of one month (the system time zone's), scope and participant (or the whole family): reloads when any changes, and
 * quietly when the data changes. The block's own person pick resets with them.
 */
export function useSpending(): UseSpendingReturn {
  const { fetchSpendingOverview } = useSpendingRequest();
  const syncStatus = useSyncStatusStore();
  const importProgress = useImportProgressStore();
  const participant = useParticipantStore();
  const { month, thisMonth } = storeToRefs(useMonthStore());
  const scope = ref<Scope>('personal');
  const pick = ref<number | null>(null);

  const participantId = () => participant.selectedId;
  const { state } = useAsyncData(
    () => {
      const id = participantId();
      return fetchSpendingOverview({ month: month.value, scope: scope.value, ...(id !== null ? { participantId: id } : {}) });
    },
    [month, scope, participantId],
    { quiet: [() => syncStatus.version] },
  );
  watch([month, scope, participantId], () => {
    pick.value = null;
  });

  // Also publishes the answer's rates to the currency button of the global filters.
  const fmt = useMoneyFormat(() => state.value.data?.rates);

  const view = computed(() => state.value.data);
  const family = computed(() => participant.multiple && participant.selectedId === null);
  const member = computed(() => participant.multiple && participant.selectedId !== null);
  const people = computed<ReadonlyArray<BlockPerson>>(() => participant.people.map((p) => ({ id: p.id, name: p.label, color: colorVar(p.color) })));
  const selected = computed<BlockPerson | null>(() => people.value.find((p) => p.id === participant.selectedId) ?? null);

  return {
    month,
    thisMonth,
    scope,
    state,
    view,
    periodNote: computed(() => (view.value ? periodNote(view.value.period) : null)),
    importing: computed(() => importProgress.running && !importProgress.auto),
    family,
    member,
    people,
    selected,
    pick,
    fmt,
  };
}
