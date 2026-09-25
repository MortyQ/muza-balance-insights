import { ref } from 'vue';
import { useTokenStore } from '@/entities/token';
import { useConnectRequest } from '../api/useConnectRequest.ts';
import type { SubmitState, UseTokenFormReturn } from '../types.ts';

export function useTokenForm(): UseTokenFormReturn {
  const { saveToken } = useConnectRequest();
  const token = useTokenStore();
  const tokenInput = ref('');
  const remember = ref(true);
  const submit = ref<SubmitState>({ status: 'idle' });

  async function save(): Promise<boolean> {
    submit.value = { status: 'saving' };
    try {
      await saveToken(tokenInput.value.trim(), remember.value);
      await token.refresh();
      submit.value = { status: 'idle' };
      return true;
    } catch {
      submit.value = { status: 'error', message: 'Токен не сохранён: проверь, что вставлен весь токен без пробелов.' };
      return false;
    } finally {
      // The token never stays in the renderer: the field is cleared whatever happened.
      tokenInput.value = '';
    }
  }

  return { tokenInput, remember, submit, save };
}
