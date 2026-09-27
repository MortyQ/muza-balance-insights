import { ref } from 'vue';
import { useParticipantStore } from '@/entities/participant';
import { useSyncStatusStore } from '@/entities/sync-status';
import { FAILED_TEXT } from '@/shared/lib';
import { usePeopleRequest } from '../api/usePeopleRequest.ts';
import { TOKEN_ERROR_TEXT } from '../constants.ts';
import type { UsePeopleActionsReturn } from '../types.ts';
import { removeText } from '../utils.ts';

export function usePeopleActions(): UsePeopleActionsReturn {
  const request = usePeopleRequest();
  const participant = useParticipantStore();
  const syncStatus = useSyncStatusStore();
  const error = ref('');

  async function rename(id: number, label: string): Promise<boolean> {
    error.value = '';
    try {
      await request.rename(id, label.trim());
      await participant.refresh();
      return true;
    } catch {
      error.value = 'Имя не сохранено: от 1 до 80 символов.';
      return false;
    }
  }

  async function setToken(connectionId: number, token: string, remember: boolean): Promise<boolean> {
    error.value = '';
    try {
      await request.setToken(connectionId, token.trim(), remember);
      await participant.refresh();
      return true;
    } catch {
      error.value = TOKEN_ERROR_TEXT;
      return false;
    }
  }

  async function remove(connectionId: number): Promise<void> {
    error.value = '';
    try {
      const r = await request.remove(connectionId);
      error.value = removeText(r);
      if (!r.removed) return;
      await participant.refresh();
      await syncStatus.refresh();
    } catch {
      error.value = FAILED_TEXT;
    }
  }

  return { error, rename, setToken, remove };
}
