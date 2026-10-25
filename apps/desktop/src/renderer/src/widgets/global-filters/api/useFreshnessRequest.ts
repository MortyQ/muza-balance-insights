import type { StartImportResult } from '@contract/progress.ts';
import { balanceApi } from '@/shared/api';

export function useFreshnessRequest(): { startImport: (from: string) => Promise<StartImportResult> } {
  return { startImport: (from) => balanceApi.startImport(from) };
}
