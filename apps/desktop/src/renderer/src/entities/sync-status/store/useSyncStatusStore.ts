import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import type { DataStatus } from '@contract/api.ts';
import { shortDate } from '@/shared/lib';
import { useSyncStatusRequest } from '../api/useSyncStatusRequest.ts';

/** What has been imported so far, and a counter the data screens reload on. */
export const useSyncStatusStore = defineStore('sync-status', () => {
  const { fetchStatus } = useSyncStatusRequest();
  const status = ref<DataStatus | null>(null);
  const failed = ref(false);
  /** Bumped whenever the numbers may have changed: the data features reload on it. */
  const version = ref(0);

  const hasData = computed(() => status.value?.hasData === true);
  const line = computed(() => {
    const s = status.value;
    if (!s) return '';
    return s.hasData && s.dataUntil ? `Данные до ${shortDate(s.dataUntil)}` : 'Данных пока нет';
  });

  async function refresh(): Promise<void> {
    try {
      status.value = await fetchStatus();
      failed.value = false;
    } catch {
      // Never read a failure as «no data»: say so, keep what was shown.
      failed.value = true;
    }
    version.value += 1;
  }

  return { status, failed, version, hasData, line, refresh };
});
