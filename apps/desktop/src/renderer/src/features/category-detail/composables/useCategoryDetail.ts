import { computed, toValue, type MaybeRefOrGetter } from 'vue';
import type { DetailPeriod, Scope } from '@contract/api.ts';
import type { CategoryId } from '@contract/categories.ts';
import { useMoneyFormat } from '@/entities/currency-display';
import { useParticipantStore } from '@/entities/participant';
import { useSyncStatusStore } from '@/entities/sync-status';
import { t, useAsyncData } from '@/shared/lib';
import { useCategoryRequest } from '../api/useCategoryRequest.ts';
import type { UseCategoryDetailReturn } from '../types.ts';

/**
 * One category of a period (a day, a week, a month) for the global filter's person (or the family) in a scope: reloads
 * when any changes, and quietly when the data changes.
 */
export function useCategoryDetail(
  categoryId: MaybeRefOrGetter<CategoryId>,
  scope: MaybeRefOrGetter<Scope>,
  period: MaybeRefOrGetter<DetailPeriod>,
): UseCategoryDetailReturn {
  const { fetchCategoryOverview, peekCategoryOverview } = useCategoryRequest();
  const syncStatus = useSyncStatusStore();
  const participant = useParticipantStore();

  const participantId = () => participant.selectedId;
  // The same query for the request and for the kept answer.
  const query = () => {
    const id = participantId();
    return { period: toValue(period), category: toValue(categoryId), scope: toValue(scope), ...(id !== null ? { participantId: id } : {}), ...participant.banksQuery() };
  };
  const { state } = useAsyncData(
    () => fetchCategoryOverview(query()),
    // The period by value: a page that rebuilds the same period does not reload.
    [() => JSON.stringify(toValue(period)), participantId, () => participant.banksKey, () => toValue(categoryId), () => toValue(scope)],
    { quiet: [() => syncStatus.version], cached: () => peekCategoryOverview(query()) },
  );

  // Also publishes the answer's rates to the currency button of the global filters.
  const fmt = useMoneyFormat(() => state.value.data?.rates);
  const family = computed(() => participant.multiple && participant.selectedId === null);
  const who = computed(() => {
    if (family.value) return t('home.spending.whole');
    return participant.multiple ? (participant.people.find((p) => p.id === participant.selectedId)?.label ?? '') : '';
  });

  return { state, view: computed(() => state.value.data), family, who, fmt };
}
