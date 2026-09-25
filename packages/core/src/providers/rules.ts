// The domain's only way into provider rules. Adding a bank = one entry here (and its folder under providers/).
import { monobankRules } from './monobank/rules.ts';
import type { ProviderId, ProviderRules } from './types.ts';

export const PROVIDER_RULES: Readonly<Record<ProviderId, ProviderRules>> = { monobank: monobankRules };

export function rulesFor(provider: ProviderId): ProviderRules {
  return PROVIDER_RULES[provider];
}
