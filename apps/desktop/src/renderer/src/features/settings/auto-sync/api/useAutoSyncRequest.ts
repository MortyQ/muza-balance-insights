import { balanceApi } from '@/shared/api';
import type { AutoSyncRequest } from '../types.ts';

export function useAutoSyncRequest(): AutoSyncRequest {
  return {
    getAutoSync: () => balanceApi.getAutoSync(),
    setAutoSync: (settings) => balanceApi.setAutoSync(settings),
  };
}
