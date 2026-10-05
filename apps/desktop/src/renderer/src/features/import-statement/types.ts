import type { Ref } from 'vue';

export interface UseImportReturn {
  /** The start date, Kyiv YYYY-MM-DD; the import runs from it up to today. */
  from: Ref<string>;
  /** `from` is a date the import accepts today (isImportFrom). */
  valid: Readonly<Ref<boolean>>;
  error: Readonly<Ref<string>>;
  start: () => Promise<void>;
  cancel: () => Promise<void>;
}
