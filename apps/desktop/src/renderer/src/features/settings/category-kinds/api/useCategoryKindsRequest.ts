import type { CategoryKindQuery, CategoryKindView } from '@contract/api.ts';
import type { KindCategoryId } from '@contract/categories.ts';
import { balanceApi } from '@/shared/api';

export function useCategoryKindsRequest(): {
  list: () => Promise<CategoryKindView[]>;
  set: (q: CategoryKindQuery) => Promise<void>;
  reset: (categoryId: KindCategoryId | null) => Promise<void>;
  cashCounts: () => Promise<boolean>;
  setCashCounts: (on: boolean) => Promise<void>;
} {
  return {
    list: () => balanceApi.getCategoryKinds(),
    set: (q) => balanceApi.setCategoryKind(q),
    reset: (categoryId) => balanceApi.resetCategoryKinds(categoryId),
    cashCounts: () => balanceApi.getCashCounts(),
    setCashCounts: (on) => balanceApi.setCashCounts(on),
  };
}
