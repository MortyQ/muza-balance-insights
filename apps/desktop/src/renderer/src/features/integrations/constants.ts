import type { Component } from 'vue';
import type { ProviderKey } from '@contract/api.ts';
import MonobankConnectFeature from './monobank/MonobankConnectFeature.vue';
import MonobankTokenField from './monobank/components/MonobankTokenField.vue';

/**
 * Each bank's forms, from its folder: `connect` — the add form around the owner fields (its default slot); `tokenField` —
 * the token field of «Ввести токен заново» in a connection row.
 */
export const PROVIDER_FORMS: Record<ProviderKey, { connect: Component; tokenField: Component }> = {
  monobank: { connect: MonobankConnectFeature, tokenField: MonobankTokenField },
};
