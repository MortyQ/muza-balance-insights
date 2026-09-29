import { t } from './i18n.ts';

export type OsFamily = 'mac' | 'windows' | 'linux' | 'other';

/** The OS the renderer runs on, from `navigator.userAgent`. */
export function osFamily(userAgent: string): OsFamily {
  if (/Macintosh|Mac OS X/.test(userAgent)) return 'mac';
  if (/Windows/.test(userAgent)) return 'windows';
  if (/Linux|X11/.test(userAgent)) return 'linux';
  return 'other';
}

/** How safeStorage keeps tokens on this OS, as the end of «Encrypted by …». */
export function osStoreName(userAgent: string): string {
  return t(`common.osStore.${osFamily(userAgent)}`);
}
