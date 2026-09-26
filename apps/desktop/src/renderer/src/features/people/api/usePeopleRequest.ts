import type { AddConnectionInput, AddConnectionResult, RemoveConnectionResult } from '@contract/api.ts';
import { balanceApi } from '@/shared/api';

export function usePeopleRequest(): {
  addConnection: (input: AddConnectionInput) => Promise<AddConnectionResult>;
  rename: (id: number, label: string) => Promise<void>;
  setToken: (connectionId: number, token: string, remember: boolean) => Promise<{ stored: 'secure' | 'memory' }>;
  remove: (connectionId: number) => Promise<RemoveConnectionResult>;
} {
  return {
    addConnection: (input) => balanceApi.addConnection(input),
    rename: (id, label) => balanceApi.renameParticipant(id, label),
    setToken: (connectionId, token, remember) => balanceApi.setConnectionToken(connectionId, token, remember),
    remove: (connectionId) => balanceApi.removeConnection(connectionId),
  };
}
