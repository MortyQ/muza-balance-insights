import type { DbStateView } from '@contract/db-state.ts';
import { t } from '@/shared/lib';
import type { NoticeTone } from '@/shared/ui';
import { KEY_STORE } from './constants.ts';

export interface EncryptionText {
  tone: NoticeTone;
  icon: string;
  text: string;
}

/** The settings card's line; null while the state is unknown or the database is not ready (the recovery screen shows). */
export function encryptionText(view: DbStateView | null): EncryptionText | null {
  if (!view || view.status !== 'ready') return null;
  if (view.encrypted) {
    return { tone: 'success', icon: 'lucide:lock', text: t('settings.dbEncryption.encrypted', { store: t(KEY_STORE[view.platform]) }) };
  }
  if (view.notice === 'no-secure-storage') {
    return { tone: 'warning', icon: 'lucide:triangle-alert', text: t('settings.dbEncryption.noSecureStorage') };
  }
  return { tone: 'warning', icon: 'lucide:triangle-alert', text: t('settings.dbEncryption.pending') };
}
