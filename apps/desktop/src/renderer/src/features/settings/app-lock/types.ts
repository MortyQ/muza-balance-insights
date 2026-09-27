import type { ComputedRef, Ref } from 'vue';
import type { BalanceApi } from '@contract/api.ts';
import type { LockTrigger, LockView } from '@contract/lock.ts';

export type AppLockRequest = Pick<
  BalanceApi,
  'unlockWithPin' | 'unlockWithTouchId' | 'deleteAllData' | 'enableLock' | 'changePin' | 'disableLock' | 'setLockTriggers' | 'setTouchId' | 'lockNow'
>;

export type LockSettingsMode = 'idle' | 'enable' | 'change' | 'disable';

export interface UseNowReturn {
  now: Readonly<Ref<number>>;
}

export interface UseUnlockReturn {
  pin: Ref<string>;
  busy: Readonly<Ref<boolean>>;
  error: Readonly<Ref<string>>;
  /** «Следующая попытка через …»; '' when a PIN can be tried now. */
  wait: ComputedRef<string>;
  broken: ComputedRef<boolean>;
  touchId: ComputedRef<boolean>;
  canForget: ComputedRef<boolean>;
  importRunning: ComputedRef<boolean>;
  submitPin: () => Promise<void>;
  unlockTouchId: () => Promise<void>;
  forgot: () => Promise<void>;
}

export interface UseLockHintReturn {
  visible: ComputedRef<boolean>;
  dismiss: () => void;
}

export interface UseLockSettingsReturn {
  view: ComputedRef<LockView | null>;
  mode: Readonly<Ref<LockSettingsMode>>;
  current: Ref<string>;
  next: Ref<string>;
  repeat: Ref<string>;
  busy: Readonly<Ref<boolean>>;
  error: Readonly<Ref<string>>;
  open: (mode: LockSettingsMode) => void;
  submit: () => Promise<void>;
  disableWithTouchId: () => Promise<void>;
  setTrigger: (trigger: LockTrigger, on: boolean) => Promise<void>;
  setTouchId: (on: boolean) => Promise<void>;
  lockNow: () => void;
}
