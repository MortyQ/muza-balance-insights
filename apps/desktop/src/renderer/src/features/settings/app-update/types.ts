import type { Ref } from 'vue';

export interface UseUpdateReturn {
  error: Readonly<Ref<string>>;
  check: () => Promise<void>;
  download: () => Promise<void>;
  install: () => Promise<void>;
  setChecks: (enabled: boolean) => Promise<void>;
}
