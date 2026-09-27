import { computed } from 'vue';
import { colorVar, useParticipantStore } from '@/entities/participant';
import { useMonthStore } from '@/entities/period';
import { useSyncStatusStore } from '@/entities/sync-status';
import { monthOf, monthTitle, useAsyncData, type YearMonth } from '@/shared/lib';
import { useBalancesRequest } from '../api/useBalancesRequest.ts';
import type { UseMonthOverviewReturn } from '../types.ts';
import { slidesOf } from '../utils.ts';

/**
 * The balance block of the selected month and person (or the whole family): reloads when either changes, and in the
 * background when the data changes (sync-status version).
 */
export function useMonthOverview(): UseMonthOverviewReturn {
  const { fetchOverview } = useBalancesRequest();
  const syncStatus = useSyncStatusStore();
  const participant = useParticipantStore();
  const monthStore = useMonthStore();
  const thisMonth = monthStore.thisMonth;
  const currentYear = Number(thisMonth.slice(0, 4));

  const firstMonth = computed<YearMonth | null>(() => {
    const from = syncStatus.status?.dataFrom;
    return from ? monthOf(from) : null;
  });
  const month = computed<string>({
    get: () => monthStore.month,
    set: (v) => monthStore.set(v as YearMonth, firstMonth.value),
  });

  const { state } = useAsyncData(
    () => {
      const id = participant.selectedId;
      return fetchOverview({ month: monthStore.month, ...(id !== null ? { participantId: id } : {}) });
    },
    [() => monthStore.month, () => participant.selectedId],
    { quiet: [() => syncStatus.version] },
  );
  const view = computed(() => state.value.data);
  const monthName = computed(() => monthTitle(monthStore.month));
  const isFamily = computed(() => participant.selectedId === null);
  const slides = computed(() =>
    view.value ? slidesOf(view.value, { people: participant.people, selectedId: participant.selectedId, currentYear }) : [],
  );
  const legend = computed(() => (view.value?.people ?? []).map((p) => ({ label: p.label, color: colorVar(p.color) })));

  return { state, view, slides, isFamily, legend, month, monthName, thisMonth, currentYear, firstMonth };
}
