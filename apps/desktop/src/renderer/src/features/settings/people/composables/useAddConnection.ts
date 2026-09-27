import { computed, ref, toValue, type MaybeRefOrGetter } from 'vue';
import type { ColorKey } from '@contract/api.ts';
import { colorHolders, firstFreeColor, useParticipantStore } from '@/entities/participant';
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
  const takenPersonColors = computed(() => colorHolders(participant.people, 'people'));
  const takenConnectionColors = computed(() => colorHolders(participant.people, 'connections'));
  // null until the user picks one: the first free colour follows the list (it changes after every added connection).
  const pickedPerson = ref<ColorKey | null>(null);
  const pickedConnection = ref<ColorKey | null>(null);
  const personColor = computed<ColorKey | null>({
    get: () => pickedPerson.value ?? firstFreeColor(takenPersonColors.value),
    set: (v) => void (pickedPerson.value = v),
  });
  const connectionColor = computed<ColorKey | null>({
    get: () => pickedConnection.value ?? firstFreeColor(takenConnectionColors.value),
    set: (v) => void (pickedConnection.value = v),
  });
  const submit = ref<SubmitState>({ status: 'idle' });
  const canSubmit = computed(() => tokenInput.value.trim() !== '' && participantChoice(person.value, newLabel.value, fromBank.value) !== null);

  async function save(): Promise<boolean> {
    const choice = participantChoice(person.value, newLabel.value, fromBank.value, personColor.value);
    if (!choice) return false;
    const color = connectionColor.value;
    submit.value = { status: 'saving' };
    try {
      const r = await addConnection({ participant: choice, provider: 'monobank', token: tokenInput.value.trim(), remember: remember.value, ...(color === null ? {} : { color }) });
      if (!r.added) {
        submit.value = { status: 'error', message: 'Этот токен уже подключён.' };
        return false;
      }
      await participant.refresh();
      submit.value = { status: 'idle' };
      person.value = 'new';
      newLabel.value = '';
      fromBank.value = false;
      pickedPerson.value = null;
      pickedConnection.value = null;
      return true;
    } catch {
      submit.value = { status: 'error', message: TOKEN_ERROR_TEXT };
      return false;
    } finally {
      // The token never stays in the renderer: the field is cleared whatever happened.
      tokenInput.value = '';
    }
  }

  return {
    person,
    newLabel,
    fromBank,
    tokenInput,
    remember,
    personColor,
    connectionColor,
    takenPersonColors,
    takenConnectionColors,
    canSubmit,
    submit,
    save,
  };
}
