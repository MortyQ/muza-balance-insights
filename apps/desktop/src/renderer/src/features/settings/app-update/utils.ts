import type { UpdateState } from '@contract/update.ts';
import { t } from '@/shared/lib';

/** The status line in settings. */
export function updateLine(s: Readonly<UpdateState>): string {
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
      return t('settings.update.ready', { version: s.version });
    case 'saved':
      return t('settings.update.saved', { version: s.version, file: s.fileName });
    case 'error':
      return s.message;
  }
  return '';
}
