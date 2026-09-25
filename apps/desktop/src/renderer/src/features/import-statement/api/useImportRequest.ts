import type { ImportDepth, StartImportResult } from '@contract/progress.ts';
import { balanceApi } from '@/shared/api';

export function useImportRequest(): { startImport: (depth: ImportDepth) => Promise<StartImportResult>; cancelImport: () => Promise<void> } {
  return {
    startImport: (depth) => balanceApi.startImport(depth),
    cancelImport: () => balanceApi.cancelImport(),
  };
}
