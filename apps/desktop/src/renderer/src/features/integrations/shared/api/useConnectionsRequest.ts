import type { AddConnectionInput, AddConnectionResult, RemoveConnectionResult } from '@contract/api.ts';
import { balanceApi } from '@/shared/api';

export function useConnectionsRequest(): {
  addConnection: (input: AddConnectionInput) => Promise<AddConnectionResult>;
  setToken: (connectionId: number, token: string, remember: boolean) => Promise<{ stored: 'secure' | 'memory' }>;
  remove: (connectionId: number) => Promise<RemoveConnectionResult>;
} {
  return {
    addConnection: (input) => balanceApi.addConnection(input),
    setToken: (connectionId, token, remember) => balanceApi.setConnectionToken(connectionId, token, remember),
    remove: (connectionId) => balanceApi.removeConnection(connectionId),
  };
}
