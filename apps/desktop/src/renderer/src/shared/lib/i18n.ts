// The interface texts: vue-i18n over the dictionaries in src/shared/i18n (uk.json is the reference). Templates use $t,
// script code uses t from here. vue-i18n 11 compiles messages at run time into a tree and walks it (no new Function):
// the prod CSP without 'unsafe-eval' holds, tests/i18n.test.ts checks the bundled builds for it.
import { createI18n } from 'vue-i18n';
import { MESSAGES, REFERENCE_LOCALE, type Messages } from '@contract/i18n/index.ts';
import { DEFAULT_LOCALE, type Locale } from '@contract/locale.ts';

declare module 'vue-i18n' {
  // Typed keys for $t and useI18n: a key missing from uk.json fails vue-tsc.
  export interface DefineLocaleMessage extends Messages {}
}

export const i18n = createI18n<[Messages], Locale, false>({
  legacy: false,
  locale: DEFAULT_LOCALE,
  fallbackLocale: REFERENCE_LOCALE,
  messages: MESSAGES,
});

export const t = i18n.global.t;

/** Switches every text at once; the page's lang follows (spellcheck, screen readers). */
export function applyLocale(locale: Locale): void {
  i18n.global.locale.value = locale;
  document.documentElement.lang = locale;
}
