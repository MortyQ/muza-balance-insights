import { type MaybeRefOrGetter, computed, ref, toValue } from 'vue';
import type { ProviderKey } from '@contract/api.ts';
import { useImportProgressStore } from '@/entities/import-progress';
import { useParticipantStore } from '@/entities/participant';
import { failedText, t } from '@/shared/lib';
import { useRefreshRequest } from '../api/useRefreshRequest.ts';
import { REFRESH_ERRORS } from '../constants.ts';
import type { UseRefreshReturn } from '../types.ts';
import { lastRefreshOf, refreshLine } from '../utils.ts';

/** «Refresh» for one bank (`bank`) or, with null, all of them: the caller's own choice of bank, not the data filter's. */
export function useRefresh(bank: MaybeRefOrGetter<ProviderKey | null>): UseRefreshReturn {
  const { refreshNow } = useRefreshRequest();
  const participant = useParticipantStore();
  const importProgress = useImportProgressStore();
  const error = ref('');
  const sending = ref(false);

  const line = computed(() => refreshLine(lastRefreshOf(participant.connections, toValue(bank)), new Date()));
  // Main refuses a second run anyway: the button says so before the click.
  const busy = computed(() => sending.value || importProgress.running);

  async function refresh(): Promise<void> {
    if (busy.value) return;
    error.value = '';
    sending.value = true;
    try {
      const r = await refreshNow(toValue(bank));
      if (!r.started) error.value = t(REFRESH_ERRORS[r.reason]);
    } catch {
      error.value = failedText();
    } finally {
      sending.value = false;
    }
  }

  return { line, error, busy, refresh };
}
