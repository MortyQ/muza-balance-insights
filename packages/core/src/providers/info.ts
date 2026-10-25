// The only list of banks: what each declares (providers/<id>/info.ts). The core, the desktop's main, worker and
// renderer learn which banks exist and how each is connected from here. Pure data: importing it loads no rules,
// reader or client. Adding a bank = one entry here (and its folder under providers/).
import { monobankInfo } from './monobank/info.ts';
import { privatbankInfo } from './privatbank/info.ts';
import type { ProviderApiInfo, ProviderId, ProviderInfo } from './types.ts';

export const PROVIDERS = { monobank: monobankInfo, privatbank: privatbankInfo } as const satisfies Readonly<Record<ProviderId, ProviderInfo>>;

/** Providers that have an API with a credential (the import, tokens, the worker). */
export type TokenProviderId = { [P in ProviderId]: (typeof PROVIDERS)[P]['access']['token'] extends null ? never : P }[ProviderId];

export const TOKEN_PROVIDER_IDS: ReadonlyArray<TokenProviderId> = (Object.keys(PROVIDERS) as ProviderId[]).filter(
  (p): p is TokenProviderId => PROVIDERS[p].access.token !== null,
);

export function infoOf(provider: ProviderId): ProviderInfo {
  return PROVIDERS[provider];
}

export function isTokenProvider(provider: ProviderId): provider is TokenProviderId {
  return PROVIDERS[provider].access.token !== null;
}

/** Whether a string has the shape of the provider's credential; a provider without an API takes none. */
export function credentialFits(provider: ProviderId, value: string): boolean {
  const token: ProviderInfo['access']['token'] = PROVIDERS[provider].access.token;
  return token !== null && token.credential.test(value);
}

/** The API facts of a provider; a provider without an API has none to plan by — an error, never a default. */
export function apiOf(provider: ProviderId): ProviderApiInfo {
  const token: ProviderInfo['access']['token'] = PROVIDERS[provider].access.token;
  if (token === null) throw new Error(`${provider} has no API`);
  return token.api;
}
