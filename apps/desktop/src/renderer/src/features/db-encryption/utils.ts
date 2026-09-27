import type { DbStateView } from '@contract/db-state.ts';
import type { NoticeTone } from '@/shared/ui';
import { ENCRYPT_PENDING, KEY_STORE, NO_SECURE_STORAGE } from './constants.ts';

export interface EncryptionText {
  tone: NoticeTone;
  icon: string;
  text: string;
}

/** The settings card's line; null while the state is unknown or the database is not ready (the recovery screen shows). */
export function encryptionText(view: DbStateView | null): EncryptionText | null {
  if (!view || view.status !== 'ready') return null;
  if (view.encrypted) {
    return { tone: 'success', icon: 'lucide:lock', text: `База на этом компьютере зашифрована; ключ хранится ${KEY_STORE[view.platform]}.` };
  }
  if (view.notice === 'no-secure-storage') return { tone: 'warning', icon: 'lucide:triangle-alert', text: NO_SECURE_STORAGE };
  return { tone: 'warning', icon: 'lucide:triangle-alert', text: ENCRYPT_PENDING };
}
