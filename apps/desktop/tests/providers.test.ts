// Every bank provider of the core has its desktop side: a credential shape (the worker's scoped fetch per provider is
// checked in tests/worker-entry.test.ts).
import { describe, expect, it } from 'vitest';
import { PROVIDER_IDS } from '@mono/core/providers/types';
import { DESKTOP_PROVIDERS } from '../src/net/providers.ts';

describe('desktop providers', () => {
  it('exactly the providers of the core', () => {
    expect(Object.keys(DESKTOP_PROVIDERS).sort()).toEqual([...PROVIDER_IDS].sort());
  });

  it('Monobank: a token-shaped string', () => {
    const { credential } = DESKTOP_PROVIDERS.monobank;
    expect(credential.test('u'.repeat(44))).toBe(true);
    expect(credential.test('short')).toBe(false);
    expect(credential.test('has a space inside it 1234567')).toBe(false);
  });
});
