import { computed, ref } from 'vue';
import type { Scope } from '@contract/api.ts';
import { useImportProgressStore } from '@/entities/import-progress';
import { useSyncStatusStore } from '@/entities/sync-status';
import { kyivToday, monthOf, monthRange, useAsyncData, type YearMonth } from '@/shared/lib';
import { useSpendingRequest } from '../api/useSpendingRequest.ts';
import type { UseSpendingReturn } from '../types.ts';
import { periodNote } from '../utils.ts';

/**
 * Spending of one Kyiv month and scope; reloads when either changes, and in the background when the data changes
 * (sync-status version: every imported window and the end of an import).
 */
export function useSpending(): UseSpendingReturn {
  const { fetchSpending } = useSpendingRequest();
  const syncStatus = useSyncStatusStore();
  const importProgress = useImportProgressStore();
  const thisMonth = monthOf(kyivToday(new Date()));
  const month = ref<YearMonth>(thisMonth);
  const scope = ref<Scope>('personal');

  const { state } = useAsyncData(() => fetchSpending({ ...monthRange(month.value), scope: scope.value }), [month, scope], {
    quiet: [() => syncStatus.version],
  });
  const view = computed(() => state.value.data);
  const note = computed(() => (view.value ? periodNote(view.value.period) : null));
  const importing = computed(() => importProgress.running);

  return { thisMonth, month, scope, state, view, periodNote: note, importing };
}
