import { computed, ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { useMoneyFormat } from '@/entities/currency-display';
import { useParticipantStore } from '@/entities/participant';
import { useRangeStore } from '@/entities/period';
import { useSyncStatusStore } from '@/entities/sync-status';
import { useAsyncData } from '@/shared/lib';
import { useAnalyticsRequest } from '../api/useAnalyticsRequest.ts';
import { DEFAULT_LINES } from '../constants.ts';
import type { LinesMode, UseAnalyticsReturn, ViewId } from '../types.ts';
import { categoryRows } from '../utils.ts';

/** The analytics of the picked period and person (or the family): reloads when either changes, quietly when the data does; the views' own state. */
export function useAnalytics(): UseAnalyticsReturn {
  const { fetchAnalyticsOverview } = useAnalyticsRequest();
  const syncStatus = useSyncStatusStore();
  const participant = useParticipantStore();
  const { range } = storeToRefs(useRangeStore());

  const participantId = () => participant.selectedId;
  const { state } = useAsyncData(
    () => {
      const id = participantId();
      return fetchAnalyticsOverview({ from: range.value.from, to: range.value.to, ...(id !== null ? { participantId: id } : {}) });
    },
    [range, participantId],
    { quiet: [() => syncStatus.version] },
  );

  // Also publishes the answer's rates to the currency button of the global filters.
  const fmt = useMoneyFormat(() => state.value.data?.rates);
  const view = computed(() => state.value.data);
  const rows = computed(() => (view.value ? categoryRows(view.value.categories, view.value.buckets.length) : []));

  const current = ref<ViewId>('heat');
  const on = ref<ReadonlySet<string>>(new Set());
  const hover = ref<string | null>(null);
  const mode = ref<LinesMode>('amount');
  const topLines = (): ReadonlySet<string> => new Set(rows.value.slice(0, DEFAULT_LINES).map((r) => r.key));
  // Another set of rows (a new period or person): the default lines follow it; a quiet reload with the same rows keeps the pick.
  watch(
    () => rows.value.map((r) => r.key).join('\u0000'),
    () => (on.value = topLines()),
    { immediate: true },
  );

  return {
    state,
    view,
    rows,
    fmt,
    current,
    on,
    hover,
    mode,
    showOnly: (key) => {
      on.value = new Set([key]);
      current.value = 'lines';
    },
    toggle: (key) => {
      const next = new Set(on.value);
      if (!next.delete(key)) next.add(key);
      on.value = next;
    },
    top: () => (on.value = topLines()),
    all: () => (on.value = new Set(rows.value.map((r) => r.key))),
  };
}
