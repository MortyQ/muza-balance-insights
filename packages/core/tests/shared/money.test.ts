// Money read from text into minor units.
import { describe, expect, it } from 'vitest';
import { toMinor } from '../../src/shared/money.ts';

describe('toMinor', () => {
  it.each([
    ['530.0', 980, 53000],
    ['-845.5', 980, -84550],
    ['0.95', 980, 95],
    ['188234.26', 980, 18823426],
    ['-0.0', 980, 0],
    ['1000.0', 392, 1000],
    ['12', 980, 1200],
  ])('%s (%i) → %i', (s, code, minor) => {
    expect(toMinor(s, code)).toBe(minor);
  });

  it.each([['12.345'], ['1 000.00'], ['1,5'], [''], ['—'], ['1e3'], ['1000.5']])('%s does not read', (s) => {
    expect(toMinor(s, s === '1000.5' ? 392 : 980)).toBeNull();
  });
});
