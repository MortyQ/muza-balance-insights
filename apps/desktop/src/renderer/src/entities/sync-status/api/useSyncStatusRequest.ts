import type { DataStatus } from '@contract/api.ts';
import { balanceApi } from '@/shared/api';

export function useSyncStatusRequest(): { fetchStatus: () => Promise<DataStatus> } {
  return { fetchStatus: () => balanceApi.getSyncStatus() };
}
