import { ref } from 'vue';
import type { ImportDepth } from '@contract/progress.ts';
import { failedText, t } from '@/shared/lib';
import { useImportRequest } from '../api/useImportRequest.ts';
import { START_ERRORS } from '../constants.ts';
import type { UseImportReturn } from '../types.ts';

export function useImport(): UseImportReturn {
  const { startImport, cancelImport } = useImportRequest();
  const depth = ref<ImportDepth>(3);
  const error = ref('');

  async function start(): Promise<void> {
    error.value = '';
    try {
      const r = await startImport(depth.value);
      if (!r.started) error.value = t(START_ERRORS[r.reason]);
    } catch {
      error.value = failedText();
    }
  }

  async function cancel(): Promise<void> {
    try {
      await cancelImport();
    } catch {
      error.value = failedText();
    }
  }

  return { depth, error, start, cancel };
}
