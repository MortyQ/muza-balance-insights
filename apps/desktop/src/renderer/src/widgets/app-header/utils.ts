import type { AppHeaderLayout } from './types.ts';

export function appHeaderLayout(ua: string): AppHeaderLayout {
  return /Macintosh|Mac OS X/.test(ua) ? 'mac' : 'overlay';
}
