import type { MessageKey } from '@contract/i18n/index.ts';
import type { UpdateError, UpdateState } from '@contract/update.ts';
import { t } from '@/shared/lib';

const ERROR_TEXT: Readonly<Record<UpdateError, MessageKey>> = {
  offline: 'settings.update.error.offline',
  rejected: 'settings.update.error.rejected',
  download: 'settings.update.error.download',
  mismatch: 'settings.update.error.mismatch',
};

/** The status line in settings and in the banner. `importRunning`: a ready update cannot restart the app yet. */
export function updateLine(s: Readonly<UpdateState>, importRunning = false): string {
  switch (s.phase) {
    case 'idle':
      return '';
    case 'checking':
      return t('settings.update.checking');
    case 'up-to-date':
      return t('settings.update.upToDate');
    case 'available':
      return t('settings.update.available', { version: s.version });
    case 'downloading':
      return t('settings.update.downloading', { version: s.version, percent: s.percent });
    case 'ready':
      return t(importRunning ? 'settings.update.readyAfterImport' : 'settings.update.ready', { version: s.version });
    case 'saved':
      return t('settings.update.saved', { version: s.version, file: s.fileName });
    case 'error':
      return t(ERROR_TEXT[s.reason]);
  }
  return '';
}
