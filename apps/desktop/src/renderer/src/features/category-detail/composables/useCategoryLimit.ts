import { computed, type ComputedRef } from 'vue';
import { storeToRefs } from 'pinia';
import type { CategoryId } from '@contract/categories.ts';
import { useMoneyFormat } from '@/entities/currency-display';
import { limitLook, type LimitLook } from '@/entities/goal';
import { useParticipantStore } from '@/entities/participant';
import { useMonthStore } from '@/entities/period';
import { useSyncStatusStore } from '@/entities/sync-status';
import { t, useAsyncData } from '@/shared/lib';
import { useCategoryRequest } from '../api/useCategoryRequest.ts';

export interface CategoryLimitView {
  /** Each limit of the category for the view: its period and look. */
  limits: Array<{ id: number; period: string; look: LimitLook }>;
  /** No limit: the suggested monthly amount, if there is one. */
  suggestion: string | null;
}

/**
 * The category's limits for the current period (spec desktop-limits-goals): only while the shown month is the current
 * one; reads the «Budget» screen's overview (kept, shared), quiet reloads on new data.
 */
export function useCategoryLimit(categoryId: () => CategoryId, shown: () => boolean): { view: ComputedRef<CategoryLimitView | null> } {
  const api = useCategoryRequest();
  const syncStatus = useSyncStatusStore();
  const participant = useParticipantStore();
  const { thisMonth } = storeToRefs(useMonthStore());
  const query = () => {
    const id = participant.selectedId;
    return { month: thisMonth.value, ...(id !== null ? { participantId: id } : {}) };
  };
  const { state } = useAsyncData(
    () => (shown() ? api.fetchLimits(query()) : Promise.resolve(null)),
    [shown, thisMonth, () => participant.selectedId],
    { quiet: [() => syncStatus.version], cached: () => (shown() ? api.peekLimits(query()) : null) },
  );
  const fmt = useMoneyFormat(() => state.value.data?.rates);
  return {
    view: computed(() => {
      const v = state.value.data;
      if (!v || !shown()) return null;
      const id = categoryId();
      const limits = v.limits.flatMap((l) => (l.categoryId === id && l.figures ? [{ id: l.id, period: t(`limits.period.${l.period}`), look: limitLook(l.figures, fmt.value, true) }] : []));
      const s = v.suggestions.find((x) => x.categoryId === id);
      return { limits, suggestion: s ? fmt.value.money(s.amount) : null };
    }),
  };
}
