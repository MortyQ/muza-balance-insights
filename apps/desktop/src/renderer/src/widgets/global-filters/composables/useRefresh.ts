import { computed, ref } from 'vue';
import { useImportProgressStore } from '@/entities/import-progress';
import { useParticipantStore } from '@/entities/participant';
import { failedText, t } from '@/shared/lib';
import { useRefreshRequest } from '../api/useRefreshRequest.ts';
import { ALL_BANKS, REFRESH_ERRORS } from '../constants.ts';
import type { UseRefreshReturn } from '../types.ts';
import { lastRefreshOf, refreshLine } from '../utils.ts';

/** «Refresh» for one bank or all of them: the popover's own choice of bank, not the data filter's. */
export function useRefresh(): UseRefreshReturn {
  const { refreshNow } = useRefreshRequest();
  const participant = useParticipantStore();
  const importProgress = useImportProgressStore();
  const bank = ref<string>(ALL_BANKS);
  const error = ref('');
  const sending = ref(false);

  const provider = computed(() => participant.providers.find((p) => p === bank.value) ?? null);
  const line = computed(() => refreshLine(lastRefreshOf(participant.connections, provider.value), new Date()));
  // Main refuses a second run anyway: the button says so before the click.
  const busy = computed(() => sending.value || importProgress.running);

  async function refresh(): Promise<void> {
    if (busy.value) return;
    error.value = '';
    sending.value = true;
    try {
      const r = await refreshNow(provider.value);
      if (!r.started) error.value = t(REFRESH_ERRORS[r.reason]);
    } catch {
      error.value = failedText();
    } finally {
      sending.value = false;
    }
  }

  return { bank, line, error, busy, refresh };
}
