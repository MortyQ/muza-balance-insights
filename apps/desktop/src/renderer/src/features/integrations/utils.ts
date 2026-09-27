import type { ProviderKey } from '@contract/api.ts';
import { DEFAULT_PROVIDER, PROVIDER_FORMS } from './constants.ts';
import type { ProviderForms } from './shared/types.ts';

export function isProviderKey(id: string): id is ProviderKey {
  return Object.hasOwn(PROVIDER_FORMS, id);
}

/** A provider's forms; one this app does not know (a database from a newer version) gets the default bank's. */
export function formsOf(provider: string): ProviderForms {
  return isProviderKey(provider) ? PROVIDER_FORMS[provider] : PROVIDER_FORMS[DEFAULT_PROVIDER];
}
