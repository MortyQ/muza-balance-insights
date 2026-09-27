import type { Ref } from 'vue';
import type { BalanceApi } from '@contract/api.ts';
import type { AutoSyncSettings, AutoSyncTrigger } from '@contract/auto-sync.ts';

export type AutoSyncRequest = Pick<BalanceApi, 'getAutoSync' | 'setAutoSync'>;

export interface UseAutoSyncSettingsReturn {
  /** null until main answers. */
  settings: Readonly<Ref<AutoSyncSettings | null>>;
  busy: Readonly<Ref<boolean>>;
  error: Readonly<Ref<string>>;
  setEnabled: (on: boolean) => Promise<void>;
  setTrigger: (trigger: AutoSyncTrigger, on: boolean) => Promise<void>;
}
