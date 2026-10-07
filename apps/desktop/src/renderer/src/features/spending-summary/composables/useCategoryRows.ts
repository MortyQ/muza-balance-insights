import { computed, type ComputedRef, type Ref } from 'vue';
import { categoryLink } from '@/shared/config';
import { t } from '@/shared/lib';
import type { SpendingPrefs, UseCategoryRowsReturn, UseSpendingReturn } from '../types.ts';
import { rowsFor } from '../utils/index.ts';

/** The category rows for the family or the block's pick, each with the screen it opens. */
export function useCategoryRows(
  base: UseSpendingReturn,
  blockPick: ComputedRef<number | null>,
  who: ComputedRef<string>,
  hasData: ComputedRef<boolean>,
  prefs: Readonly<Ref<SpendingPrefs>>,
): UseCategoryRowsReturn {
  const { view, people, scope, fmt } = base;
  const rows = computed(() => (view.value ? rowsFor(view.value, blockPick.value, people.value, prefs.value, fmt.value) : []));
  const categories = computed(() => ({
    rows: rows.value.map((r) => ({ ...r, to: r.categoryId ? categoryLink(r.categoryId, scope.value) : null })),
    none: hasData.value && rows.value.length === 0 ? t('home.spending.noneBy', { name: who.value }) : '',
  }));
  return { rows, categories };
}
