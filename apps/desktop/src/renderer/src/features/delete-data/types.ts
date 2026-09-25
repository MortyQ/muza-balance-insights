import type { Ref } from 'vue';

export interface UseDeleteDataReturn {
  deleting: Readonly<Ref<boolean>>;
  error: Readonly<Ref<string>>;
  /** true = everything was deleted (and the token / data stores are refreshed). */
  run: () => Promise<boolean>;
}
