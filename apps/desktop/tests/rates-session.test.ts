// The rates request runs in its own Electron session: every request and redirect hop is checked against the
// monobank-rates service only, permissions are refused, and the fetch goes through allowlistedFetch.
import { describe, expect, it } from 'vitest';
import { RATES_PARTITION, guardRatesSession, ratesFetch, type RatesSessionLike } from '../src/main/rates-session.ts';

function fakeSession() {
  let before: ((d: { url: string }, cb: (r: { cancel: boolean }) => void) => void) | null = null;
  let perm: ((wc: unknown, p: string, cb: (g: boolean) => void) => void) | null = null;
  const fetched: Array<[string, unknown]> = [];
  const ses: RatesSessionLike = {
    webRequest: { onBeforeRequest: (h) => void (before = h) },
    setPermissionRequestHandler: (h) => void (perm = h),
    fetch: async (url, init) => {
      fetched.push([url, init]);
      return new Response('[]', { status: 200 });
    },
  };
  const check = (url: string) => {
    let cancel: boolean | undefined;
    before!({ url }, (r) => (cancel = r.cancel));
    return cancel;
  };
  const granted = () => {
    let g: boolean | undefined;
    perm!(null, 'geolocation', (x) => (g = x));
    return g;
  };
  return { ses, check, granted, fetched };
}

describe('rates session', () => {
  it('its own partition', () => {
    expect(RATES_PARTITION).toBe('monobank-rates');
  });

  it('only the rates host passes; permissions refused', () => {
    const f = fakeSession();
    guardRatesSession(f.ses);
    expect(f.check('https://api.monobank.ua/bank/currency')).toBe(false);
    expect(f.check('https://github.com/x')).toBe(true);
    expect(f.check('http://api.monobank.ua/bank/currency')).toBe(true);
    expect(f.granted()).toBe(false);
  });

  it('ratesFetch refuses other hosts before the network and never follows redirects', async () => {
    const f = fakeSession();
    const fetch = ratesFetch(f.ses);
    await fetch('https://api.monobank.ua/bank/currency', { headers: {} });
    await expect(fetch('https://evil.example/x', { headers: {} })).rejects.toThrow();
    expect(f.fetched).toEqual([['https://api.monobank.ua/bank/currency', { headers: {}, redirect: 'error' }]]);
  });
});
