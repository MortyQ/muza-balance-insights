import type { ProviderKey } from '@contract/api.ts';
import { DEFAULT_PROVIDER, PROVIDER_FORMS } from './constants.ts';
import type { ProviderForms } from './shared/types.ts';

export function isProviderKey(id: string): id is ProviderKey {
  return Object.hasOwn(PROVIDER_FORMS, id);
}

/**
 * A provider's forms; one this app does not know (only in a database written by a newer version) gets Monobank's forms,
 * while `bankOf` may still show that bank's name in the row.
 */
export function formsOf(provider: string): ProviderForms {
  return isProviderKey(provider) ? PROVIDER_FORMS[provider] : PROVIDER_FORMS[DEFAULT_PROVIDER];
}

/** The title of the «Добавить подключение» panel. */
export function newConnectionTitle(bankName: string): string {
  return `Новое подключение ${bankName}`;
}
