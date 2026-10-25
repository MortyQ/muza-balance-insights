// Every bank with an API has its desktop side: the trusted service its client may reach. The name and the credential
// shape are the core's (providers/info.ts); the worker's scoped fetch per provider is checked in
// tests/worker-entry.test.ts.
import { describe, expect, it } from 'vitest';
import { apiOf, credentialFits, TOKEN_PROVIDER_IDS } from '@mono/core/providers/info';
import { isAllowedUrl } from '../src/net/allowlist.ts';
import { DESKTOP_PROVIDERS } from '../src/net/providers.ts';
import { WORKER_PROVIDERS } from '../src/worker/providers.ts';

describe('desktop providers', () => {
  it('exactly the core providers with an API, on main’s side and in the worker', () => {
    expect(Object.keys(DESKTOP_PROVIDERS).sort()).toEqual([...TOKEN_PROVIDER_IDS].sort());
    expect(Object.keys(WORKER_PROVIDERS).sort()).toEqual([...TOKEN_PROVIDER_IDS].sort());
  });

  it("each client's origin is a host of the service it is scoped to", () => {
    for (const p of TOKEN_PROVIDER_IDS) {
      expect(isAllowedUrl(`${apiOf(p).origin}/`, [DESKTOP_PROVIDERS[p].service]), p).toBe(true);
    }
  });

  it('Monobank: a token-shaped string', () => {
    expect(credentialFits('monobank', 'u'.repeat(44))).toBe(true);
    expect(credentialFits('monobank', 'short')).toBe(false);
    expect(credentialFits('monobank', 'has a space inside it 1234567')).toBe(false);
  });
});
