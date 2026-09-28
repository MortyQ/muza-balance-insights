import { t } from './i18n.ts';

/** How safeStorage keeps tokens on this OS, as the end of «Encrypted by …». */
export function osStoreName(userAgent: string): string {
  if (/Macintosh|Mac OS X/.test(userAgent)) return t('common.osStore.mac');
  if (/Windows/.test(userAgent)) return t('common.osStore.windows');
  if (/Linux|X11/.test(userAgent)) return t('common.osStore.linux');
  return t('common.osStore.other');
}
