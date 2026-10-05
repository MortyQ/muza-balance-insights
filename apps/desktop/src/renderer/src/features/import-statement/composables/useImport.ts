import { computed, ref, type Ref } from 'vue';
import { isImportFrom, monthsBefore } from '@contract/import-range.ts';
import { failedText, t } from '@/shared/lib';
import { useImportRequest } from '../api/useImportRequest.ts';
import { DEFAULT_PRESET, START_ERRORS } from '../constants.ts';
import type { UseImportReturn } from '../types.ts';

/** `today`: the local date the period is counted back from. */
export function useImport(today: Readonly<Ref<string>>): UseImportReturn {
  const { startImport, cancelImport } = useImportRequest();
  const from = ref(monthsBefore(today.value, DEFAULT_PRESET));
  const valid = computed(() => isImportFrom(from.value, today.value));
  const error = ref('');

  async function start(): Promise<void> {
    error.value = '';
    if (!valid.value) return;
    try {
      const r = await startImport(from.value);
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

  return { from, valid, error, start, cancel };
}
