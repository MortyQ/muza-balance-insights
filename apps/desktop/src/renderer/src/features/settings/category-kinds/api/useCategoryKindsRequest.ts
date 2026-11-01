import type { CategoryKindQuery, CategoryKindView } from '@contract/api.ts';
import type { KindCategoryId } from '@contract/categories.ts';
import { balanceApi } from '@/shared/api';

export function useCategoryKindsRequest(): {
  list: () => Promise<CategoryKindView[]>;
  set: (q: CategoryKindQuery) => Promise<void>;
  reset: (categoryId: KindCategoryId | null) => Promise<void>;
} {
  return {
    list: () => balanceApi.getCategoryKinds(),
    set: (q) => balanceApi.setCategoryKind(q),
    reset: (categoryId) => balanceApi.resetCategoryKinds(categoryId),
  };
}
