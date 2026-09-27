import type { ComputedRef, Ref } from 'vue';
import type { BalanceApi } from '@contract/api.ts';
import type { DbStateView } from '@contract/db-state.ts';

export type DbRecoveryRequest = Pick<BalanceApi, 'relaunchApp' | 'startOver' | 'quitApp'>;

export type RecoveryAction = 'relaunch' | 'startOver' | 'delete' | 'quit';

export interface RecoveryText {
  title: string;
  detail: string;
  /** The button drawn as the main one. */
  primary: 'relaunch' | 'startOver';
}

export interface UseDbRecoveryReturn {
  view: Readonly<Ref<DbStateView | null>>;
  text: ComputedRef<RecoveryText | null>;
  busy: Readonly<Ref<RecoveryAction | null>>;
  error: Readonly<Ref<string>>;
  run: (action: RecoveryAction) => Promise<void>;
}
