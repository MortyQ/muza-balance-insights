import { ref } from 'vue';
import type { ColorChangeResult, ColorKey } from '@contract/api.ts';
import { useParticipantStore } from '@/entities/participant';
import { useSyncStatusStore } from '@/entities/sync-status';
import { FAILED_TEXT } from '@/shared/lib';
import { usePeopleRequest } from '../api/usePeopleRequest.ts';
import { COLOR_TAKEN_TEXT, TOKEN_ERROR_TEXT } from '../constants.ts';
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

  async function restoreBankName(id: number): Promise<boolean> {
    error.value = '';
    try {
      await request.restoreBankName(id);
      await participant.refresh();
      return true;
    } catch {
      error.value = FAILED_TEXT;
      return false;
    }
  }

  async function changeColor(change: () => Promise<ColorChangeResult>): Promise<boolean> {
    error.value = '';
    try {
      const r = await change();
      await participant.refresh();
      if (!r.changed) error.value = COLOR_TAKEN_TEXT;
      return r.changed;
    } catch {
      error.value = FAILED_TEXT;
      return false;
    }
  }

  const setPersonColor = (id: number, color: ColorKey) => changeColor(() => request.setPersonColor(id, color));
  const setConnectionColor = (connectionId: number, color: ColorKey) => changeColor(() => request.setConnectionColor(connectionId, color));

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

  return { error, rename, restoreBankName, setPersonColor, setConnectionColor, setToken, remove };
}
