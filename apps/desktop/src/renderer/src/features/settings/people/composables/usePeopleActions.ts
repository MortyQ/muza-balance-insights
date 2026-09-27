import { ref } from 'vue';
import type { ColorKey } from '@contract/api.ts';
import { COLOR_TAKEN_TEXT, useParticipantStore } from '@/entities/participant';
import { FAILED_TEXT } from '@/shared/lib';
import { usePeopleRequest } from '../api/usePeopleRequest.ts';
import type { UsePeopleActionsReturn } from '../types.ts';

export function usePeopleActions(): UsePeopleActionsReturn {
  const request = usePeopleRequest();
  const participant = useParticipantStore();
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

  async function setPersonColor(id: number, color: ColorKey): Promise<boolean> {
    error.value = '';
    try {
      const r = await request.setPersonColor(id, color);
      await participant.refresh();
      if (!r.changed) error.value = COLOR_TAKEN_TEXT;
      return r.changed;
    } catch {
      error.value = FAILED_TEXT;
      return false;
    }
  }

  return { error, rename, restoreBankName, setPersonColor };
}
