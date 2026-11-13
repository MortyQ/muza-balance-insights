import { computed, type ComputedRef, type Ref } from 'vue';
import { useParticipantStore } from '@/entities/participant';
import { categoryLink, spendingCategoriesLink } from '@/shared/config';
import { t } from '@/shared/lib';
import type { SpendingPrefs, UseCategoryRowsReturn, UseSpendingReturn } from '../types.ts';
import { REST_KEY } from '../constants.ts';
import { rowsFor } from '../utils/index.ts';

/**
 * The category rows for the family or the block's pick, each with the screen it opens; the «N more categories» row
 * opens «All categories». `all` — every category its own row (that screen's list).
 */
export function useCategoryRows(
  base: UseSpendingReturn,
  blockPick: ComputedRef<number | null>,
  who: ComputedRef<string>,
  hasData: ComputedRef<boolean>,
  prefs: Readonly<Ref<SpendingPrefs>>,
  all = false,
): UseCategoryRowsReturn {
  const { view, people, scope, fmt } = base;
  const participant = useParticipantStore();
  const rows = computed(() =>
    view.value ? rowsFor(view.value, blockPick.value, people.value, prefs.value, fmt.value, participant.shown.length > 1, all) : [],
  );
  const categories = computed(() => ({
    rows: rows.value.map((r) => ({ ...r, to: r.categoryId ? categoryLink(r.categoryId, scope.value) : r.key === REST_KEY ? spendingCategoriesLink() : null })),
    none: hasData.value && rows.value.length === 0 ? t('home.spending.noneBy', { name: who.value }) : '',
  }));
  return { rows, categories };
}
