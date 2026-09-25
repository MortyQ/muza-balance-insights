// The domain's only way into provider rules. Adding a bank = one entry here (and its folder under providers/).
import { monobankRules } from './monobank/rules.ts';
import type { ProviderId, ProviderRules } from './types.ts';

export const PROVIDER_RULES: Readonly<Record<ProviderId, ProviderRules>> = { monobank: monobankRules };

/**
 * Until connections exist (step 2 of the connections spec) every account is Monobank's; loaders pass this, and the
 * provider will come from connections.provider instead.
 */
export const LEGACY_PROVIDER: ProviderId = 'monobank';

export function rulesFor(provider: ProviderId): ProviderRules {
  return PROVIDER_RULES[provider];
}
