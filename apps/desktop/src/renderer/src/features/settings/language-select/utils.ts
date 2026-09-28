import { applyLocale } from '@/shared/lib';
import { useLocaleRequest } from './api/useLocaleRequest.ts';

/** Before the first screen: the saved language, else the system's (main decides). Main unreachable — the default stays. */
export async function loadLocale(): Promise<void> {
  try {
    applyLocale(await useLocaleRequest().get());
  } catch (e) {
    console.error('[i18n] locale failed', e);
  }
}
