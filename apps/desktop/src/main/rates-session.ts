// The network of the rates request: its own Electron session (the default one is the renderer's and refuses
// everything), guarded for every request and redirect hop by the monobank-rates service only. No cookies or cache
// shared with anything else; nothing but the public /bank/currency ever goes through it.
import type { FetchLike } from '@mono/core/platform';
import { allowlistedFetch, isAllowedUrl, type InnerFetch } from '../net/allowlist.ts';

export const RATES_PARTITION = 'monobank-rates';

type Callback<T> = (response: T) => void;
export type RatesSessionLike = {
  webRequest: { onBeforeRequest(h: (details: { url: string }, cb: Callback<{ cancel: boolean }>) => void): void };
  setPermissionRequestHandler(h: ((wc: unknown, permission: string, cb: (granted: boolean) => void) => void) | null): void;
  fetch: (url: string, init: Parameters<InnerFetch>[1]) => ReturnType<InnerFetch>;
};

export function guardRatesSession(ses: RatesSessionLike, onBlocked?: (host: string) => void): void {
  ses.webRequest.onBeforeRequest((details, cb) => {
    const ok = isAllowedUrl(details.url, ['monobank-rates']);
    if (!ok) onBlocked?.(hostOf(details.url));
    cb({ cancel: !ok });
  });
  ses.setPermissionRequestHandler((_wc, _permission, cb) => cb(false));
}

export function ratesFetch(ses: RatesSessionLike): FetchLike {
  return allowlistedFetch((url, init) => ses.fetch(url, init), ['monobank-rates']);
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return '(bad url)';
  }
}
