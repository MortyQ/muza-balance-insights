import { storeToRefs } from 'pinia';
import { computed, ref } from 'vue';
import { useDbStateStore } from '@/entities/db-state';
import { useDeleteAllDataRequest } from '../../shared/api/useDeleteAllDataRequest.ts';
import { useDbRecoveryRequest } from '../api/useDbRecoveryRequest.ts';
import { ACTION_ERROR } from '../constants.ts';
import type { RecoveryAction, UseDbRecoveryReturn } from '../types.ts';
import { recoveryText } from '../utils.ts';

/** Every button whatever the status: a wrong guess between «unavailable» and «lost» never takes a way out away. */
export function useDbRecovery(): UseDbRecoveryReturn {
  const request = useDbRecoveryRequest();
  const { deleteAllData } = useDeleteAllDataRequest();
  const { view } = storeToRefs(useDbStateStore());
  const text = computed(() => recoveryText(view.value));
  const busy = ref<RecoveryAction | null>(null);
  const error = ref('');

  // A database that becomes ready arrives as a push (app/listeners.ts moves on); cancelled dialogs change nothing.
  const actions: Record<RecoveryAction, () => Promise<unknown>> = {
    relaunch: () => request.relaunchApp(),
    startOver: () => request.startOver(),
    delete: () => deleteAllData(),
    quit: () => request.quitApp(),
  };

  async function run(action: RecoveryAction): Promise<void> {
    if (busy.value) return;
    error.value = '';
    busy.value = action;
    try {
      await actions[action]();
    } catch {
      error.value = ACTION_ERROR;
    } finally {
      busy.value = null;
    }
  }

  return { view, text, busy, error, run };
}
