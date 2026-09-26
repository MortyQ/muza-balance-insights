import { computed, ref, toValue, type MaybeRefOrGetter } from 'vue';
import { useParticipantStore } from '@/entities/participant';
import { usePeopleRequest } from '../api/usePeopleRequest.ts';
import { TOKEN_ERROR_TEXT } from '../constants.ts';
import type { PersonChoice, SubmitState, UseAddConnectionReturn } from '../types.ts';
import { participantChoice } from '../utils.ts';

/** A new Monobank connection for an existing person or a new one (typed name, or the name from the bank). */
export function useAddConnection(defaultLabel: MaybeRefOrGetter<string>): UseAddConnectionReturn {
  const { addConnection } = usePeopleRequest();
  const participant = useParticipantStore();
  const person = ref<PersonChoice>('new');
  const newLabel = ref(toValue(defaultLabel));
  const fromBank = ref(false);
  const tokenInput = ref('');
  const remember = ref(true);
  const submit = ref<SubmitState>({ status: 'idle' });
  const canSubmit = computed(() => tokenInput.value.trim() !== '' && participantChoice(person.value, newLabel.value, fromBank.value) !== null);

  async function save(): Promise<boolean> {
    const choice = participantChoice(person.value, newLabel.value, fromBank.value);
    if (!choice) return false;
    submit.value = { status: 'saving' };
    try {
      const r = await addConnection({ participant: choice, provider: 'monobank', token: tokenInput.value.trim(), remember: remember.value });
      if (!r.added) {
        submit.value = { status: 'error', message: 'Этот токен уже подключён.' };
        return false;
      }
      await participant.refresh();
      submit.value = { status: 'idle' };
      person.value = 'new';
      newLabel.value = '';
      fromBank.value = false;
      return true;
    } catch {
      submit.value = { status: 'error', message: TOKEN_ERROR_TEXT };
      return false;
    } finally {
      // The token never stays in the renderer: the field is cleared whatever happened.
      tokenInput.value = '';
    }
  }

  return { person, newLabel, fromBank, tokenInput, remember, canSubmit, submit, save };
}
