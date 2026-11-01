import { ref, toValue, type MaybeRefOrGetter } from 'vue';
import type { CategoryId } from '@contract/categories.ts';
import { useSyncStatusStore } from '@/entities/sync-status';
import { t } from '@/shared/lib';
import { useCategoryRequest } from '../api/useCategoryRequest.ts';
import { CHOICE_ACTION } from '../constants.ts';
import type { PickingLine, UseCategoryChoiceReturn } from '../types.ts';
import { choiceDoneText } from '../utils.ts';

/**
 * The user's category of the list's debits: the row menu's actions, the picker and what they did. A write refreshes the
 * data status, so every screen reloads quietly (the line may leave this category).
 */
export function useCategoryChoice(lineOf: MaybeRefOrGetter<(key: string) => PickingLine | null>): UseCategoryChoiceReturn {
  const { saveOperationCategory } = useCategoryRequest();
  const syncStatus = useSyncStatusStore();
  const picking = ref<PickingLine | null>(null);
  const busy = ref(false);
  const notice = ref<{ text: string; failed: boolean } | null>(null);

  async function write(key: string, category: CategoryId | null, payee: boolean): Promise<boolean> {
    busy.value = true;
    try {
      const { changed } = await saveOperationCategory({ key, category, payee });
      notice.value = { text: choiceDoneText(changed), failed: false };
      await syncStatus.refresh();
      return true;
    } catch (e) {
      console.error('[category] choice failed', e instanceof Error ? e.name : 'Error');
      notice.value = { text: t('category.choice.failed'), failed: true };
      return false;
    } finally {
      busy.value = false;
    }
  }

  function act(key: string, action: string): void {
    if (action === CHOICE_ACTION.change) {
      const line = toValue(lineOf)(key);
      // After the menu has closed and given focus back, so the sheet takes it.
      if (line) setTimeout(() => (picking.value = line), 0);
    } else if (action === CHOICE_ACTION.reset) void write(key, null, false);
    else if (action === CHOICE_ACTION.resetPayee) void write(key, null, true);
  }

  async function save(category: CategoryId, payee: boolean): Promise<void> {
    const line = picking.value;
    if (!line) return;
    if (await write(line.key, category, payee)) picking.value = null;
  }

  return { picking, busy, notice, act, save };
}
