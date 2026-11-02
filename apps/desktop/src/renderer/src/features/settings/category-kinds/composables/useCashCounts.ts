import { ref, type Ref } from 'vue';
import { useSyncStatusStore } from '@/entities/sync-status';
import { failedText } from '@/shared/lib';
import { useCategoryKindsRequest } from '../api/useCategoryKindsRequest.ts';

/**
 * «Count cash withdrawals as spending» (spec desktop-category-kinds): the switch shows a change at once and returns to
 * what main stores, with a message, when it could not be saved; after a save the screens that show spending reload.
 */
export function useCashCounts(): { on: Readonly<Ref<boolean | null>>; error: Readonly<Ref<string>>; set: (next: boolean) => Promise<void> } {
  const request = useCategoryKindsRequest();
  const syncStatus = useSyncStatusStore();
  const on = ref<boolean | null>(null);
  const error = ref('');

  async function load(): Promise<void> {
    try {
      on.value = await request.cashCounts();
    } catch {
      error.value = failedText();
    }
  }
  void load();

  async function set(next: boolean): Promise<void> {
    error.value = '';
    on.value = next;
    try {
      await request.setCashCounts(next);
      void syncStatus.refresh();
    } catch {
      error.value = failedText();
    }
    await load();
  }

  return { on, error, set };
}
