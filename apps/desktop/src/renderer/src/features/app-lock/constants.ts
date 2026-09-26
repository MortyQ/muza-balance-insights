import type { LockTrigger } from '@contract/lock.ts';
import type { LockSettingsMode } from './types.ts';

export const TRIGGER_LABELS = {
  startup: 'При запуске приложения',
  idle: 'После 60 минут без активности',
  screenLock: 'При блокировке экрана',
  sleep: 'При уходе компьютера в сон',
} as const satisfies Record<LockTrigger, string>;

export const SUBMIT_TEXT = {
  idle: '',
  enable: 'Готово',
  change: 'Сменить PIN',
  disable: 'Выключить',
} as const satisfies Record<LockSettingsMode, string>;
