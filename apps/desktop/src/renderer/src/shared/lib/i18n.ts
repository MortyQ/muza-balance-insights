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

/**
 * Plurals in every dictionary have three forms, «one | few | many» (the test keeps the count equal across locales):
 * uk and ru need all three, English repeats the plural in the last two. The form is chosen by the language's own
 * rule (Intl.PluralRules), not vue-i18n's default (which reads three forms as «zero | one | many»).
 */
export function pluralForm(locale: Locale): (choice: number, choicesLength: number) => number {
  const rules = new Intl.PluralRules(locale);
  return (choice, choicesLength) => {
    if (choicesLength !== 3) return Math.min(choicesLength - 1, choice === 1 ? 0 : 1);
    const category = rules.select(choice);
    return category === 'one' ? 0 : category === 'few' ? 1 : 2;
  };
}

export const i18n = createI18n<[Messages], Locale, false>({
  legacy: false,
  locale: DEFAULT_LOCALE,
  fallbackLocale: REFERENCE_LOCALE,
  messages: MESSAGES,
  pluralRules: { uk: pluralForm('uk'), en: pluralForm('en'), ru: pluralForm('ru') },
});

export const t = i18n.global.t;

/** Switches every text at once; the page's lang follows (spellcheck, screen readers). */
export function applyLocale(locale: Locale): void {
  i18n.global.locale.value = locale;
  document.documentElement.lang = locale;
}
