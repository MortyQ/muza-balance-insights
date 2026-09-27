import type { ProviderKey } from '@contract/api.ts';
import MonobankConnectFeature from './monobank/MonobankConnectFeature.vue';
import MonobankTokenField from './monobank/components/MonobankTokenField.vue';
import type { ProviderForms } from './shared/types.ts';

/**
 * Each bank's forms, from its folder: `connect` — the add form around the owner fields (its default slot); `tokenField` —
 * the token field of «Ввести токен заново» in a connection row.
 */
export const PROVIDER_FORMS: Record<ProviderKey, ProviderForms> = {
  monobank: { connect: MonobankConnectFeature, tokenField: MonobankTokenField },
};

/** The bank «Добавить подключение» adds (the only one available), and the forms of a provider this app does not know. */
export const DEFAULT_PROVIDER: ProviderKey = 'monobank';
