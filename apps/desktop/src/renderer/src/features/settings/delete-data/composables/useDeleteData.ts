import { ref } from 'vue';
import { useSyncStatusStore } from '@/entities/sync-status';
import { useParticipantStore } from '@/entities/participant';
import { t } from '@/shared/lib';
import { useDeleteAllDataRequest } from '../../shared/api/useDeleteAllDataRequest.ts';
import type { UseDeleteDataReturn } from '../types.ts';

export function useDeleteData(): UseDeleteDataReturn {
  const { deleteAllData } = useDeleteAllDataRequest();
  const participant = useParticipantStore();
  const syncStatus = useSyncStatusStore();
  const deleting = ref(false);
  const error = ref('');

  async function run(): Promise<boolean> {
    error.value = '';
    deleting.value = true;
    try {
      const { deleted } = await deleteAllData();
      if (!deleted) return false;
      await participant.refresh();
      await syncStatus.refresh();
      return true;
    } catch {
      error.value = t('settings.deleteData.error');
      return false;
    } finally {
      deleting.value = false;
    }
  }

  return { deleting, error, run };
}
