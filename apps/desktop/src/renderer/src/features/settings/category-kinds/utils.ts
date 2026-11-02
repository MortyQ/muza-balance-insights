import type { CategoryKindView } from '@contract/api.ts';
import { CATEGORY_ICON, categoryName } from '@/entities/category';
import type { CategoryKindRowView } from './types.ts';

export function kindRows(kinds: ReadonlyArray<CategoryKindView>, cashCounts: boolean): CategoryKindRowView[] {
  return kinds.map((k) => ({
    categoryId: k.categoryId,
    name: categoryName({ category: k.categoryId, categoryId: k.categoryId }),
    icon: CATEGORY_ICON[k.categoryId],
    kind: k.kind,
    fixed: k.fixed,
    changed: k.changed,
    notCounted: k.categoryId === 'cash' && !cashCounts,
  }));
}
