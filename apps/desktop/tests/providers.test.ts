// Every bank provider of the core has its desktop side: a credential shape and the trusted services of its import.
import { describe, expect, it } from 'vitest';
import { PROVIDER_IDS } from '@mono/core/providers/types';
import { TRUSTED_SERVICES } from '../src/net/allowlist.ts';
import { DESKTOP_PROVIDERS } from '../src/net/providers.ts';

describe('desktop providers', () => {
  it('exactly the providers of the core, each with at least one known service', () => {
    expect(Object.keys(DESKTOP_PROVIDERS).sort()).toEqual([...PROVIDER_IDS].sort());
    const known = new Set<string>(TRUSTED_SERVICES.map((s) => s.id));
    for (const p of Object.values(DESKTOP_PROVIDERS)) {
      expect(p.services.length).toBeGreaterThan(0);
      for (const s of p.services) expect(known.has(s)).toBe(true);
    }
  });

  it('Monobank: a token-shaped string, only its own API', () => {
    const { credential, services } = DESKTOP_PROVIDERS.monobank;
    expect(credential.test('u'.repeat(44))).toBe(true);
    expect(credential.test('short')).toBe(false);
    expect(credential.test('has a space inside it 1234567')).toBe(false);
    expect(services).toEqual(['monobank']);
  });
});
