import type { DbStateView } from '@contract/db-state.ts';
import type { MessageKey } from '@contract/i18n/index.ts';

/** Where the key lives, as the end of «the key is kept in …». */
export const KEY_STORE: Record<DbStateView['platform'], MessageKey> = {
  darwin: 'settings.dbEncryption.keyStore.darwin',
  win32: 'settings.dbEncryption.keyStore.win32',
  linux: 'settings.dbEncryption.keyStore.linux',
  other: 'settings.dbEncryption.keyStore.other',
};
