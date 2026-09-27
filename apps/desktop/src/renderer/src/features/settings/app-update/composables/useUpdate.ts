import { ref } from 'vue';
import type { UpdateView } from '@contract/update.ts';
import { useAppUpdateStore } from '@/entities/app-update';
import { FAILED_TEXT } from '@/shared/lib';
import { useUpdateActions } from '../api/useUpdateActions.ts';
import type { UseUpdateReturn } from '../types.ts';

export function useUpdate(): UseUpdateReturn {
  const actions = useUpdateActions();
  const store = useAppUpdateStore();
  const error = ref('');

  async function run(action: () => Promise<UpdateView>): Promise<void> {
    error.value = '';
    try {
      store.set(await action());
    } catch {
      error.value = FAILED_TEXT;
    }
  }

  async function install(): Promise<void> {
    error.value = '';
    try {
      const r = await actions.install();
      if (!r.started && r.reason === 'import-running') error.value = 'Идёт импорт — обновление установится, когда он закончится и приложение закроется.';
    } catch {
      error.value = FAILED_TEXT;
    }
  }

  return {
    error,
    check: () => run(actions.check),
    download: () => run(actions.download),
    install,
    setChecks: (enabled) => run(() => actions.setChecks(enabled)),
  };
}
