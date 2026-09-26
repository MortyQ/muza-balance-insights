import type { LockView } from '@contract/lock.ts';
import { balanceApi } from '@/shared/api';

export function useLockStateRequest(): { fetchView: () => Promise<LockView> } {
  return { fetchView: () => balanceApi.getLockState() };
}
