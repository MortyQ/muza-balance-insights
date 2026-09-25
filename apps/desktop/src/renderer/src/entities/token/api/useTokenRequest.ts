import type { TokenStatus } from '@contract/api.ts';
import { balanceApi } from '@/shared/api';

export function useTokenRequest(): { fetchStatus: () => Promise<TokenStatus> } {
  return { fetchStatus: () => balanceApi.hasToken() };
}
