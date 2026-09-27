import { computed, watch } from 'vue';
import { colorVar, useParticipantStore } from '@/entities/participant';
import { useMonthStore } from '@/entities/period';
import { useSyncStatusStore } from '@/entities/sync-status';
import { monthOf, useAsyncData, type YearMonth } from '@/shared/lib';
import { useBalancesRequest } from '../api/useBalancesRequest.ts';
import type { TaggedOverview, UseMonthOverviewReturn } from '../types.ts';
import { monthName as monthNameOf, slidesOf } from '../utils.ts';

/**
 * The balance block of the selected month and person (or the whole family): reloads when either changes, and in the
 * background when the data changes (sync-status version). Everything shown is derived from the answer and the person
 * it was asked for, so the previous answer kept during a reload never appears under the new person's labels.
 */
export function useMonthOverview(): UseMonthOverviewReturn {
  const { fetchOverview } = useBalancesRequest();
  const syncStatus = useSyncStatusStore();
  const participant = useParticipantStore();
  const monthStore = useMonthStore();
  const thisMonth = computed(() => monthStore.thisMonth);
  const currentYear = computed(() => Number(thisMonth.value.slice(0, 4)));

  const firstMonth = computed<YearMonth | null>(() => {
    const from = syncStatus.status?.dataFrom;
    return from ? monthOf(from) : null;
  });
  const month = computed<string>({
    get: () => monthStore.month,
    set: (v) => monthStore.set(v as YearMonth, firstMonth.value),
  });
  // The first data month can move later (a re-import that starts fresher); re-clamp the selection to it.
  watch(firstMonth, (first) => monthStore.set(monthStore.month, first));

  const { state } = useAsyncData(
    async (): Promise<TaggedOverview> => {
      const id = participant.selectedId;
      const overview = await fetchOverview({ month: monthStore.month, ...(id !== null ? { participantId: id } : {}) });
      return { participantId: id, overview };
    },
    [() => monthStore.month, () => participant.selectedId],
    { quiet: [() => syncStatus.version] },
  );
  const view = computed(() => state.value.data?.overview ?? null);
  const shownId = computed<number | null>(() => state.value.data?.participantId ?? null);
  const monthName = computed(() => monthNameOf(view.value?.month ?? monthStore.month, currentYear.value));
  const isFamily = computed(() => shownId.value === null);
  const slides = computed(() =>
    view.value ? slidesOf(view.value, { people: participant.people, selectedId: shownId.value, currentYear: currentYear.value }) : [],
  );
  const legend = computed(() =>
    (view.value?.people ?? []).map((p) => ({ participantId: p.participantId, label: p.label, color: colorVar(p.color) })),
  );

  return { state, view, slides, isFamily, legend, month, monthName, thisMonth, currentYear, firstMonth };
}
