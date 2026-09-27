import type { Locale } from '@contract/locale.ts';
import { balanceApi } from '@/shared/api';

export function useLocaleRequest(): { get: () => Promise<Locale>; set: (locale: Locale) => Promise<Locale> } {
  return {
    get: () => balanceApi.getLocale(),
    set: (locale) => balanceApi.setLocale(locale),
  };
}
