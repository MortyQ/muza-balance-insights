import { balanceApi } from '@/shared/api';

export function useConnectRequest(): {
  saveToken: (token: string, remember: boolean) => Promise<{ stored: 'secure' | 'memory' }>;
  clearToken: () => Promise<void>;
} {
  return {
    saveToken: (token, remember) => balanceApi.setToken(token, remember),
    clearToken: () => balanceApi.clearToken(),
  };
}
