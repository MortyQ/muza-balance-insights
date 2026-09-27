import { ref } from 'vue';
import type { ColorKey } from '@contract/api.ts';
import { COLOR_TAKEN_TEXT, useParticipantStore } from '@/entities/participant';
import { useSyncStatusStore } from '@/entities/sync-status';
import { FAILED_TEXT } from '@/shared/lib';
import { useConnectionsRequest } from '../api/useConnectionsRequest.ts';
import { TOKEN_ERROR_TEXT } from '../constants.ts';
import type { UseConnectionActionsReturn } from '../types.ts';
import { removeText } from '../utils.ts';

/** What a connection row does, for any bank: the token form itself comes from the bank's folder. */
export function useConnectionActions(): UseConnectionActionsReturn {
  const request = useConnectionsRequest();
  const participant = useParticipantStore();
  const syncStatus = useSyncStatusStore();
  const error = ref('');

  async function setConnectionColor(connectionId: number, color: ColorKey): Promise<boolean> {
    error.value = '';
    try {
      const r = await request.setConnectionColor(connectionId, color);
      await participant.refresh();
      if (!r.changed) error.value = COLOR_TAKEN_TEXT;
      return r.changed;
    } catch {
      error.value = FAILED_TEXT;
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

  return { error, setConnectionColor, setToken, remove };
}
