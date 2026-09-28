import type { MessageKey } from '@contract/i18n/index.ts';
import type { LockTrigger } from '@contract/lock.ts';
import type { LockSettingsMode } from './types.ts';

export const TRIGGER_LABELS = {
  startup: 'settings.lock.triggerStartup',
  idle: 'settings.lock.triggerIdle',
  screenLock: 'settings.lock.triggerScreenLock',
  sleep: 'settings.lock.triggerSleep',
} as const satisfies Record<LockTrigger, MessageKey>;

/** The submit button of each form; idle shows no form. */
export const SUBMIT_TEXT = {
  idle: 'settings.lock.submitEnable',
  enable: 'settings.lock.submitEnable',
  change: 'settings.lock.changePin',
  disable: 'settings.lock.submitDisable',
} as const satisfies Record<LockSettingsMode, MessageKey>;

/** «Not now» on the home hint: a convenience of this computer only, never data. */
export const HINT_KEY = 'balance.lock-hint';
