import type { ComputedRef, Ref } from 'vue';

export type SubmitState = { status: 'idle' } | { status: 'saving' } | { status: 'error'; message: string };

/** An existing participant's id, or a new person. */
export type PersonChoice = number | 'new';

export interface UseAddConnectionReturn {
  person: Ref<PersonChoice>;
  newLabel: Ref<string>;
  /** The new person's name comes from the bank on the first import. */
  fromBank: Ref<boolean>;
  tokenInput: Ref<string>;
  remember: Ref<boolean>;
  canSubmit: ComputedRef<boolean>;
  submit: Readonly<Ref<SubmitState>>;
  /** true = added; the token field is cleared either way. */
  save: () => Promise<boolean>;
}

export interface UsePeopleActionsReturn {
  error: Readonly<Ref<string>>;
  rename: (id: number, label: string) => Promise<boolean>;
  /** true = saved; the caller clears its field either way. */
  setToken: (connectionId: number, token: string, remember: boolean) => Promise<boolean>;
  remove: (connectionId: number) => Promise<void>;
}
