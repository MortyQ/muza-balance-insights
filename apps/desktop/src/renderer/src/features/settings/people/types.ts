import type { ComputedRef, Ref } from 'vue';
import type { ColorKey } from '@contract/api.ts';

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
  /** The chosen colours; until one is picked — the first free one. */
  personColor: Ref<ColorKey | null>;
  connectionColor: Ref<ColorKey | null>;
  /** Colour → who has it, among people and among connections. */
  takenPersonColors: ComputedRef<Map<ColorKey, string>>;
  takenConnectionColors: ComputedRef<Map<ColorKey, string>>;
  canSubmit: ComputedRef<boolean>;
  submit: Readonly<Ref<SubmitState>>;
  /** true = added; the token field is cleared either way. */
  save: () => Promise<boolean>;
}

export interface UsePeopleActionsReturn {
  error: Readonly<Ref<string>>;
  rename: (id: number, label: string) => Promise<boolean>;
  /** «Взять имя из банка» after a rename. */
  restoreBankName: (id: number) => Promise<boolean>;
  setPersonColor: (id: number, color: ColorKey) => Promise<boolean>;
  setConnectionColor: (connectionId: number, color: ColorKey) => Promise<boolean>;
  /** true = saved; the caller clears its field either way. */
  setToken: (connectionId: number, token: string, remember: boolean) => Promise<boolean>;
  remove: (connectionId: number) => Promise<void>;
}
