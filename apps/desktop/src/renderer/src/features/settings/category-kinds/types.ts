import type { ComputedRef, Ref } from 'vue';
import type { CategoryKind, CategoryKindView } from '@contract/api.ts';
import type { KindCategoryId } from '@contract/categories.ts';

export interface CategoryKindRowView {
  categoryId: KindCategoryId;
  name: string;
  icon: string;
  kind: CategoryKind;
  fixed: boolean;
  changed: boolean;
  /** «Cash» while cash withdrawals do not count as spending. */
  notCounted: boolean;
}

export interface UseCategoryKindsReturn {
  /** null until main has answered. */
  rows: ComputedRef<CategoryKindRowView[] | null>;
  anyChanged: ComputedRef<boolean>;
  error: Readonly<Ref<string>>;
  change: (categoryId: KindCategoryId, next: Pick<CategoryKindView, 'kind' | 'fixed'>) => Promise<void>;
  resetAll: () => Promise<void>;
}
