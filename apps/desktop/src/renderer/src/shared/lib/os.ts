/** How safeStorage keeps tokens on this OS, as the end of «Зашифрованы …». */
export function osStoreName(userAgent: string): string {
  if (/Macintosh|Mac OS X/.test(userAgent)) return 'связкой ключей macOS';
  if (/Windows/.test(userAgent)) return 'защищённым хранилищем Windows';
  if (/Linux|X11/.test(userAgent)) return 'хранилищем паролей системы';
  return 'системным хранилищем';
}
