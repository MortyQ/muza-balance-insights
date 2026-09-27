import { ref } from 'vue';
import type { ImportDepth } from '@contract/progress.ts';
import { FAILED_TEXT } from '@/shared/lib';
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
      if (!r.started) error.value = START_ERRORS[r.reason];
    } catch {
      error.value = FAILED_TEXT;
    }
  }

  async function cancel(): Promise<void> {
    try {
      await cancelImport();
    } catch {
      error.value = FAILED_TEXT;
    }
  }

  return { depth, error, start, cancel };
}
