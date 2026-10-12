import type { ComputedRef, Ref } from 'vue';

export interface UseRefreshReturn {
  /** When the bank's data was last refreshed, worded. */
  line: ComputedRef<string>;
  /** Why the last refresh did not start; '' when it did. */
  error: Ref<string>;
  /** A request is in flight or an import runs: the button is off. */
  busy: ComputedRef<boolean>;
  refresh: () => Promise<void>;
}
