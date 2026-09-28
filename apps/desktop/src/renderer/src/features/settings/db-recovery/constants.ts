import type { DbStateView } from '@contract/db-state.ts';
import type { MessageKey } from '@contract/i18n/index.ts';
import type { RecoveryAction } from './types.ts';

type NotReady = Exclude<DbStateView['status'], 'ready'>;

export const TITLES: Record<NotReady, MessageKey> = {
  'key-unavailable': 'settings.dbRecovery.title.keyUnavailable',
  'key-lost': 'settings.dbRecovery.title.keyLost',
  'db-unreadable': 'settings.dbRecovery.title.dbUnreadable',
};

/** key-unavailable depends on where the key lives; neutral wording, no advice to press «Always Allow». */
export const UNAVAILABLE_DETAIL: Record<DbStateView['platform'], MessageKey> = {
  darwin: 'settings.dbRecovery.unavailable.darwin',
  linux: 'settings.dbRecovery.unavailable.linux',
  win32: 'settings.dbRecovery.unavailable.other',
  other: 'settings.dbRecovery.unavailable.other',
};

export const DETAILS: Record<Exclude<NotReady, 'key-unavailable'>, MessageKey> = {
  'key-lost': 'settings.dbRecovery.detail.keyLost',
  'db-unreadable': 'settings.dbRecovery.detail.dbUnreadable',
};

export const ACTION_TEXT: Record<RecoveryAction, MessageKey> = {
  relaunch: 'settings.dbRecovery.action.relaunch',
  startOver: 'settings.dbRecovery.action.startOver',
  delete: 'settings.dbRecovery.action.delete',
  quit: 'settings.dbRecovery.action.quit',
};
