// Texts main shows itself: the menu, the confirmation dialogs, the Touch ID prompt, About. The renderer's dictionaries,
// keys under `main.` plus the disclaimer. These texts are plain: no placeholders, plural forms or linked messages
// (tests/main-i18n.test.ts), so main reads them as they are and vue-i18n stays out of main.
import { MESSAGES, REFERENCE_LOCALE, type MessageKey } from '../shared/i18n/index.ts';
import type { Locale } from '../shared/locale.ts';

export type MainKey = Extract<MessageKey, `main.${string}`> | 'common.disclaimer';
export type Translate = (key: MainKey) => string;

function lookup(dict: unknown, key: string): string | undefined {
  let node = dict;
  for (const part of key.split('.')) {
    if (typeof node !== 'object' || node === null) return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === 'string' ? node : undefined;
}

/** A missing text falls back to the reference dictionary, then to the key itself (never an empty menu item). */
export function translator(locale: Locale): Translate {
  return (key) => lookup(MESSAGES[locale], key) ?? lookup(MESSAGES[REFERENCE_LOCALE], key) ?? key;
}
