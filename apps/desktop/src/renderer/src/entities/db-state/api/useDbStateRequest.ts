import type { DbStateView } from '@contract/db-state.ts';
import { balanceApi } from '@/shared/api';

export function useDbStateRequest(): { fetchView: () => Promise<DbStateView> } {
  return { fetchView: () => balanceApi.getDbState() };
}
