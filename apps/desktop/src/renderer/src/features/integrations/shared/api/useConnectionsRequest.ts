import type { AddConnectionInput, AddConnectionResult, ColorChangeResult, ColorKey, RemoveConnectionResult } from '@contract/api.ts';
import { balanceApi } from '@/shared/api';

export function useConnectionsRequest(): {
  addConnection: (input: AddConnectionInput) => Promise<AddConnectionResult>;
  setConnectionColor: (connectionId: number, color: ColorKey) => Promise<ColorChangeResult>;
  setToken: (connectionId: number, token: string, remember: boolean) => Promise<{ stored: 'secure' | 'memory' }>;
  remove: (connectionId: number) => Promise<RemoveConnectionResult>;
} {
  return {
    addConnection: (input) => balanceApi.addConnection(input),
    setConnectionColor: (connectionId, color) => balanceApi.setConnectionColor(connectionId, color),
    setToken: (connectionId, token, remember) => balanceApi.setConnectionToken(connectionId, token, remember),
    remove: (connectionId) => balanceApi.removeConnection(connectionId),
  };
}
