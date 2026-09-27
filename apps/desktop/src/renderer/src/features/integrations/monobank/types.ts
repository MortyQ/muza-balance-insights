import type { ComputedRef, Ref } from 'vue';
import type { SubmitState } from '../shared/types.ts';

export interface UseMonobankConnectReturn {
  tokenInput: Ref<string>;
  remember: Ref<boolean>;
  canSubmit: ComputedRef<boolean>;
  submit: Readonly<Ref<SubmitState>>;
  /** true = added; the token field is cleared either way. */
  save: () => Promise<boolean>;
}
