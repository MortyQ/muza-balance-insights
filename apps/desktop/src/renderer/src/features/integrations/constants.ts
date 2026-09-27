import type { ProviderKey } from '@contract/api.ts';
import MonobankConnectFeature from './monobank/MonobankConnectFeature.vue';
import MonobankTokenField from './monobank/components/MonobankTokenField.vue';
import { ACCESS_NOTE as MONOBANK_ACCESS_NOTE } from './monobank/constants.ts';
import type { ProviderForms } from './shared/types.ts';

/**
 * Each bank's forms and texts, from its folder: `connect` — the add form around the owner fields (its default slot);
 * `tokenField` — the token field of «Ввести токен заново» in a connection row; `accessNote` — the first screen's line.
 */
export const PROVIDER_FORMS: Record<ProviderKey, ProviderForms> = {
  monobank: { connect: MonobankConnectFeature, tokenField: MonobankTokenField, accessNote: MONOBANK_ACCESS_NOTE },
};

/** The bank «Добавить подключение» adds (the only one available), and the forms of a provider this app does not know. */
export const DEFAULT_PROVIDER: ProviderKey = 'monobank';
