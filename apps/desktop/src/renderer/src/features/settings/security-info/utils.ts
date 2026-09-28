import { t } from '@/shared/lib';

export type TokensStorage = { ok: boolean; badge: string; hint: string };

/** The «Tokens» row; null while main has not said whether this machine has a secret store. */
export function tokensStorage(secure: boolean | null, storeName: string): TokensStorage | null {
  if (secure === null) return null;
  return secure
    ? {
        ok: true,
        badge: t('settings.securityInfo.storage.secureBadge'),
        hint: t('settings.securityInfo.storage.secureHint', { store: storeName }),
      }
    : {
        ok: false,
        badge: t('settings.securityInfo.storage.insecureBadge'),
        hint: t('settings.securityInfo.storage.insecureHint'),
      };
}
