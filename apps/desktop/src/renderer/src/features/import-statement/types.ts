import type { Ref } from 'vue';
import type { ImportDepth } from '@contract/progress.ts';

export interface UseImportReturn {
  depth: Ref<ImportDepth>;
  error: Readonly<Ref<string>>;
  start: () => Promise<void>;
  cancel: () => Promise<void>;
}
