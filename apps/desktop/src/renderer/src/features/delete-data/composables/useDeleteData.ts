import { ref } from 'vue';
import { useSyncStatusStore } from '@/entities/sync-status';
import { useTokenStore } from '@/entities/token';
import { useDeleteDataRequest } from '../api/useDeleteDataRequest.ts';
import type { UseDeleteDataReturn } from '../types.ts';

export function useDeleteData(): UseDeleteDataReturn {
  const { deleteAllData } = useDeleteDataRequest();
  const token = useTokenStore();
  const syncStatus = useSyncStatusStore();
  const deleting = ref(false);
  const error = ref('');

  async function run(): Promise<boolean> {
    error.value = '';
    deleting.value = true;
    try {
      const { deleted } = await deleteAllData();
      if (!deleted) return false;
      await token.refresh();
      await syncStatus.refresh();
      return true;
    } catch {
      error.value = 'Не всё удалось удалить. Перезапусти приложение и попробуй ещё раз.';
      return false;
    } finally {
      deleting.value = false;
    }
  }

  return { deleting, error, run };
}
