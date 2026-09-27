import type { ComputedRef, Ref } from 'vue';
import type { ColorKey, ParticipantChoice } from '@contract/api.ts';

export type SubmitState = { status: 'idle' } | { status: 'saving' } | { status: 'error'; message: string };

/** An existing participant's id, or a new person. */
export type PersonChoice = number | 'new';

/** Whose a new connection is and its colours — the part of the add form that is the same for every bank. */
export interface UseConnectionOwnerReturn {
  person: Ref<PersonChoice>;
  newLabel: Ref<string>;
  /** The new person's name comes from the bank on the first import. */
  fromBank: Ref<boolean>;
  /** The chosen colours; until one is picked — the first free one. */
  personColor: Ref<ColorKey | null>;
  connectionColor: Ref<ColorKey | null>;
  /** Colour → who has it, among people and among connections. */
  takenPersonColors: ComputedRef<Map<ColorKey, string>>;
  takenConnectionColors: ComputedRef<Map<ColorKey, string>>;
  /** Who the connection is for, with the new person's colour; null while a new person has no name. */
  owner: ComputedRef<ParticipantChoice | null>;
  /** Back to a new person with no name and the first free colours, after a connection is added. */
  reset: () => void;
}

export interface UseConnectionActionsReturn {
  error: Readonly<Ref<string>>;
  setConnectionColor: (connectionId: number, color: ColorKey) => Promise<boolean>;
  /** true = saved; the caller clears its field either way. */
  setToken: (connectionId: number, token: string, remember: boolean) => Promise<boolean>;
  remove: (connectionId: number) => Promise<void>;
}
