import { computed, ref, toValue, type MaybeRefOrGetter } from 'vue';
import type { ColorKey } from '@contract/api.ts';
import { colorHolders, firstFreeColor, useParticipantStore } from '@/entities/participant';
import type { PersonChoice, UseConnectionOwnerReturn } from '../types.ts';
import { participantChoice } from '../utils.ts';

/**
 * Whose a new connection is (an existing person, or a new one: typed name or the name from the bank, and a colour);
 * `initial` — the choice it starts with and returns to after an add.
 */
export function useConnectionOwner(defaultLabel: MaybeRefOrGetter<string>, initial: PersonChoice = 'new'): UseConnectionOwnerReturn {
  const participant = useParticipantStore();
  const person = ref<PersonChoice>(initial);
  const newLabel = ref(toValue(defaultLabel));
  const fromBank = ref(false);
  const takenPersonColors = computed(() => colorHolders(participant.people));
  // null until the user picks one: the first free colour follows the list (it changes after every added person).
  const pickedPerson = ref<ColorKey | null>(null);
  const personColor = computed<ColorKey | null>({
    get: () => pickedPerson.value ?? firstFreeColor(takenPersonColors.value),
    set: (v) => void (pickedPerson.value = v),
  });
  const owner = computed(() => participantChoice(person.value, newLabel.value, fromBank.value, personColor.value));

  function reset() {
    person.value = initial;
    newLabel.value = '';
    fromBank.value = false;
    pickedPerson.value = null;
  }

  return { person, newLabel, fromBank, personColor, takenPersonColors, owner, reset };
}
