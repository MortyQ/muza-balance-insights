import type { PersonView, ProviderKey } from '@contract/api.ts';
import { t } from '@/shared/lib';
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

/** The people with their connections at the bank (`provider` null: every bank); a person with none there is left out. */
export function peopleOfBank(people: ReadonlyArray<Readonly<PersonView>>, provider: ProviderKey | null): PersonView[] {
  return people
    .map((p) => ({ ...p, connections: p.connections.filter((c) => provider === null || c.provider === provider) }))
    .filter((p) => p.connections.length > 0);
}

/** The title of the «Add connection» panel. */
export function newConnectionTitle(bankName: string): string {
  return t('integrations.connections.newTitle', { bank: bankName });
}
