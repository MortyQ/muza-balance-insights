import type { Ref } from 'vue';

export type SubmitState = { status: 'idle' } | { status: 'saving' } | { status: 'error'; message: string };

export interface UseTokenFormReturn {
  tokenInput: Ref<string>;
  remember: Ref<boolean>;
  submit: Readonly<Ref<SubmitState>>;
  /** true = saved; the field is cleared either way. */
  save: () => Promise<boolean>;
}

export interface UseDisconnectReturn {
  error: Readonly<Ref<string>>;
  disconnect: () => Promise<boolean>;
}
