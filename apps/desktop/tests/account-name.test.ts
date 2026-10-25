// Account names for the balance cards and the import line: parts only, told apart like the core's accountLabels.
import { describe, expect, it } from 'vitest';
import { accountLabels } from '@mono/core/shared/format';
import { accountNames } from '../src/shared/account-name.ts';

const ACCOUNTS = [
  { id: 'aaaa1', provider: 'monobank', kind: 'card', type: 'black', currency: 980 },
  { id: 'bbbb2', provider: 'monobank', kind: 'card', type: 'black', currency: 980 },
  { id: 'cccc3', provider: 'monobank', kind: 'card', type: 'black', currency: 840 },
  { id: 'dddd4', provider: 'monobank', kind: 'jar', type: null, currency: 980 },
  { id: 'eeee5', provider: 'monobank', kind: 'jar', type: 'x', currency: 980 },
  { id: 'ffff6', provider: 'monobank', kind: 'card', type: null, currency: 978 },
];

describe('accountNames', () => {
  it('kind, type, currency; a tag only where two accounts would read the same', () => {
    expect(Object.fromEntries(accountNames(ACCOUNTS))).toEqual({
      aaaa1: { provider: 'monobank', kind: 'card', type: 'black', currency: 980, tag: 'aaaa' },
      bbbb2: { provider: 'monobank', kind: 'card', type: 'black', currency: 980, tag: 'bbbb' },
      cccc3: { provider: 'monobank', kind: 'card', type: 'black', currency: 840, tag: null },
      dddd4: { provider: 'monobank', kind: 'jar', type: null, currency: 980, tag: 'dddd' },
      eeee5: { provider: 'monobank', kind: 'jar', type: null, currency: 980, tag: 'eeee' },
      ffff6: { provider: 'monobank', kind: 'card', type: null, currency: 978, tag: null },
    });
  });

  it('a tag from the account\'s own id: after a provider prefix and a file account\'s «file-»', () => {
    const names = accountNames([
      { id: 'fictional:aaaa1', provider: 'fictional', kind: 'card', type: null, currency: 980 },
      { id: 'fictional:bbbb2', provider: 'fictional', kind: 'card', type: null, currency: 980 },
      { id: 'file-cccc3', provider: 'monobank', kind: 'card', type: 'black', currency: 980 },
      { id: 'file-dddd4', provider: 'monobank', kind: 'card', type: 'black', currency: 980 },
    ]);
    expect([...names.values()].map((n) => n.tag)).toEqual(['aaaa', 'bbbb', 'cccc', 'dddd']);
  });

  it('tags exactly the accounts the core would tell apart', () => {
    const core = accountLabels(ACCOUNTS.map((a) => ({ ...a, currencyCode: a.currency })));
    for (const [id, name] of accountNames(ACCOUNTS)) expect(name.tag !== null, id).toBe(core.get(id)!.includes('#'));
  });
});
