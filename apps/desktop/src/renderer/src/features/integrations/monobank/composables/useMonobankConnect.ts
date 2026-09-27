import { computed, ref, toValue, type MaybeRefOrGetter } from 'vue';
import type { ColorKey, ParticipantChoice } from '@contract/api.ts';
import { useParticipantStore } from '@/entities/participant';
import { useConnectionsRequest } from '../../shared/api/useConnectionsRequest.ts';
import { TOKEN_ERROR_TEXT } from '../../shared/constants.ts';
import type { SubmitState } from '../../shared/types.ts';
import { DUPLICATE_TOKEN_TEXT } from '../constants.ts';
import type { UseMonobankConnectReturn } from '../types.ts';

/** A new Monobank connection by a personal token, for the owner chosen in the add form. */
export function useMonobankConnect(
  owner: MaybeRefOrGetter<ParticipantChoice | null>,
  connectionColor: MaybeRefOrGetter<ColorKey | null>,
): UseMonobankConnectReturn {
  const { addConnection } = useConnectionsRequest();
  const participant = useParticipantStore();
  const tokenInput = ref('');
  const remember = ref(true);
  const submit = ref<SubmitState>({ status: 'idle' });
  const canSubmit = computed(() => tokenInput.value.trim() !== '' && toValue(owner) !== null);

  async function save(): Promise<boolean> {
    const choice = toValue(owner);
    if (!choice) return false;
    const color = toValue(connectionColor);
    submit.value = { status: 'saving' };
    try {
      const r = await addConnection({ participant: choice, provider: 'monobank', token: tokenInput.value.trim(), remember: remember.value, ...(color === null ? {} : { color }) });
      if (!r.added) {
        submit.value = { status: 'error', message: DUPLICATE_TOKEN_TEXT };
        return false;
      }
      await participant.refresh();
      submit.value = { status: 'idle' };
      return true;
    } catch {
      submit.value = { status: 'error', message: TOKEN_ERROR_TEXT };
      return false;
    } finally {
      // The token never stays in the renderer: the field is cleared whatever happened.
      tokenInput.value = '';
    }
  }

  return { tokenInput, remember, canSubmit, submit, save };
}
