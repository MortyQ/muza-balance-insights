import type { Ref } from 'vue';
import type { ColorKey } from '@contract/api.ts';

export interface UsePeopleActionsReturn {
  error: Readonly<Ref<string>>;
  rename: (id: number, label: string) => Promise<boolean>;
  /** «Use the name from the bank» after a rename. */
  restoreBankName: (id: number) => Promise<boolean>;
  setPersonColor: (id: number, color: ColorKey) => Promise<boolean>;
}
