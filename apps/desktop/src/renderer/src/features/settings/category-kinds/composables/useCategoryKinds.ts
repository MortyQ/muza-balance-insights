import { computed, onMounted, ref, type Ref } from 'vue';
import type { CategoryKindView } from '@contract/api.ts';
import type { KindCategoryId } from '@contract/categories.ts';
import { useSyncStatusStore } from '@/entities/sync-status';
import { failedText } from '@/shared/lib';
import { useCategoryKindsRequest } from '../api/useCategoryKindsRequest.ts';
import type { UseCategoryKindsReturn } from '../types.ts';
import { kindRows } from '../utils.ts';

/**
 * The «Categories» section: every category's kind and fixed flag. A change shows at once and is rolled back with a
 * message if main could not save it; after a save the data status refreshes, so the screens that use kinds reload.
 */
export function useCategoryKinds(cashCounts: Readonly<Ref<boolean | null>>): UseCategoryKindsReturn {
  const request = useCategoryKindsRequest();
  const syncStatus = useSyncStatusStore();
  const kinds = ref<CategoryKindView[] | null>(null);
  const error = ref('');

  async function load(): Promise<void> {
    try {
      kinds.value = await request.list();
    } catch {
      error.value = failedText();
    }
  }
  onMounted(load);

  async function saved(call: () => Promise<void>): Promise<void> {
    error.value = '';
    try {
      await call();
      void syncStatus.refresh();
    } catch {
      error.value = failedText();
    }
    await load();
  }

  async function change(categoryId: KindCategoryId, next: Pick<CategoryKindView, 'kind' | 'fixed'>): Promise<void> {
    if (kinds.value) kinds.value = kinds.value.map((k) => (k.categoryId === categoryId ? { ...k, ...next } : k));
    await saved(() => request.set({ categoryId, ...next }));
  }

  return {
    rows: computed(() => (kinds.value ? kindRows(kinds.value, cashCounts.value !== false) : null)),
    anyChanged: computed(() => kinds.value?.some((k) => k.changed) ?? false),
    error,
    change,
    resetAll: () => saved(() => request.reset(null)),
  };
}
