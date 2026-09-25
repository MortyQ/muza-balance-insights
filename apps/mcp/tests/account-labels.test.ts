import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { MCP_ROOT } from '../src/paths.ts';
import { accountLabels } from '@mono/core/format';

describe('account labels in logs', () => {
  it('type + currency, never a card number; duplicates get an id prefix', () => {
    const labels = accountLabels([
      { id: 'aaaa1111', kind: 'card', type: 'black', currencyCode: 980 },
      { id: 'bbbb2222', kind: 'card', type: 'black', currencyCode: 840 },
      { id: 'cccc3333', kind: 'jar', type: null, currencyCode: 980 },
      { id: 'dddd4444', kind: 'jar', type: null, currencyCode: 980 },
    ]);
    expect(Object.fromEntries(labels)).toEqual({
      aaaa1111: 'black/UAH',
      bbbb2222: 'black/USD',
      cccc3333: 'банка/UAH #cccc',
      dddd4444: 'банка/UAH #dddd',
    });
  });

  it('CLI entry points never read masked_pan or iban', () => {
    const dir = path.join(MCP_ROOT, 'src', 'cli');
    const offenders = fs
      .readdirSync(dir)
      .filter((f) => f.endsWith('.ts'))
      .filter((f) => /\b(masked_pan|iban)\b/.test(fs.readFileSync(path.join(dir, f), 'utf8').replace(/\/\/.*|\/\*[\s\S]*?\*\/|^\s*\*.*$/gm, '')));
    expect(offenders).toEqual([]);
  });
});
