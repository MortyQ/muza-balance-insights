import { onMounted, ref } from 'vue';
import type { AutoSyncSettings, AutoSyncTrigger } from '@contract/auto-sync.ts';
import { failedText } from '@/shared/lib';
import { useAutoSyncRequest } from '../api/useAutoSyncRequest.ts';
import type { UseAutoSyncSettingsReturn } from '../types.ts';
import { withChange } from '../utils.ts';

export function useAutoSyncSettings(): UseAutoSyncSettingsReturn {
  const request = useAutoSyncRequest();
  const settings = ref<AutoSyncSettings | null>(null);
  const busy = ref(false);
  const error = ref('');

  async function save(next: AutoSyncSettings): Promise<void> {
    busy.value = true;
    error.value = '';
    try {
      settings.value = await request.setAutoSync(next);
    } catch {
      error.value = failedText();
    } finally {
      busy.value = false;
    }
  }

  function setEnabled(on: boolean): Promise<void> {
    const s = settings.value;
    return s ? save(withChange(s, { enabled: on })) : Promise.resolve();
  }

  function setTrigger(trigger: AutoSyncTrigger, on: boolean): Promise<void> {
    const s = settings.value;
    return s ? save(withChange(s, { trigger, on })) : Promise.resolve();
  }

  onMounted(async () => {
    try {
      settings.value = await request.getAutoSync();
    } catch {
      error.value = failedText();
    }
  });

  return { settings, busy, error, setEnabled, setTrigger };
}
