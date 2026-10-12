import type { ProviderKey } from '@contract/api.ts';
import type { StartImportResult } from '@contract/progress.ts';
import { balanceApi } from '@/shared/api';

/** `provider`: the bank to refresh; null — every bank. */
export function useRefreshRequest(): { refreshNow: (provider: ProviderKey | null) => Promise<StartImportResult> } {
  return { refreshNow: (provider) => balanceApi.refreshNow(provider !== null ? { provider } : {}) };
}
