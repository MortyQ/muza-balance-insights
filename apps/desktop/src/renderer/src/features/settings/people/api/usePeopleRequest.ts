import type { AddConnectionInput, AddConnectionResult, ColorChangeResult, ColorKey, RemoveConnectionResult } from '@contract/api.ts';
import { balanceApi } from '@/shared/api';

export function usePeopleRequest(): {
  addConnection: (input: AddConnectionInput) => Promise<AddConnectionResult>;
  rename: (id: number, label: string) => Promise<void>;
  restoreBankName: (id: number) => Promise<void>;
  setPersonColor: (id: number, color: ColorKey) => Promise<ColorChangeResult>;
  setConnectionColor: (connectionId: number, color: ColorKey) => Promise<ColorChangeResult>;
  setToken: (connectionId: number, token: string, remember: boolean) => Promise<{ stored: 'secure' | 'memory' }>;
  remove: (connectionId: number) => Promise<RemoveConnectionResult>;
} {
  return {
    addConnection: (input) => balanceApi.addConnection(input),
    rename: (id, label) => balanceApi.renameParticipant(id, label),
    restoreBankName: (id) => balanceApi.restoreBankName(id),
    setPersonColor: (id, color) => balanceApi.setParticipantColor(id, color),
    setConnectionColor: (connectionId, color) => balanceApi.setConnectionColor(connectionId, color),
    setToken: (connectionId, token, remember) => balanceApi.setConnectionToken(connectionId, token, remember),
    remove: (connectionId) => balanceApi.removeConnection(connectionId),
  };
}
