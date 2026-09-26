import { describe, expect, it } from 'vitest';
import { WAIT_MS, waitAfter } from '../src/main/lock/attempts.ts';

describe('waitAfter (pause after the n-th wrong PIN in a row)', () => {
  it('the first four: no pause', () => {
    expect([1, 2, 3, 4].map(waitAfter)).toEqual([0, 0, 0, 0]);
  });

  it('5th → 30 s, 6th → 1 min, 7th → 5 min, 8th and later → 15 min', () => {
    expect([5, 6, 7, 8, 9, 50].map(waitAfter)).toEqual([30_000, 60_000, 300_000, 900_000, 900_000, 900_000]);
    expect(WAIT_MS.at(-1)).toBe(15 * 60_000);
  });
});
