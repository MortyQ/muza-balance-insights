import type { ColorChangeResult, ColorKey } from '@contract/api.ts';
import { balanceApi } from '@/shared/api';

export function usePeopleRequest(): {
  rename: (id: number, label: string) => Promise<void>;
  restoreBankName: (id: number) => Promise<void>;
  setPersonColor: (id: number, color: ColorKey) => Promise<ColorChangeResult>;
} {
  return {
    rename: (id, label) => balanceApi.renameParticipant(id, label),
    restoreBankName: (id) => balanceApi.restoreBankName(id),
    setPersonColor: (id, color) => balanceApi.setParticipantColor(id, color),
  };
}
