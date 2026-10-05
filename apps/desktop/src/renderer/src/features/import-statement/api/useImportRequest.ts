import type { StartImportResult } from '@contract/progress.ts';
import { balanceApi } from '@/shared/api';

export function useImportRequest(): { startImport: (from: string) => Promise<StartImportResult>; cancelImport: () => Promise<void> } {
  return {
    startImport: (from) => balanceApi.startImport(from),
    cancelImport: () => balanceApi.cancelImport(),
  };
}
