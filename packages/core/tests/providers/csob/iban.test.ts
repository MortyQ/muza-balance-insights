import { describe, expect, it } from 'vitest';
import { czIban, czIbanOfSlashed } from '../../../src/providers/csob/iban.ts';

/** Any IBAN is valid when its rearranged digits leave 1 by 97. */
function valid(iban: string): boolean {
  const moved = iban.slice(4) + iban.slice(0, 4);
  const digits = [...moved].map((ch) => (/\d/.test(ch) ? ch : String(ch.charCodeAt(0) - 55))).join('');
  let rest = 0;
  for (const d of digits) rest = (rest * 10 + Number(d)) % 97;
  return rest === 1;
}

describe('czIban', () => {
  it('pads the number and an absent prefix', () => {
    const iban = czIban('123456789', '0300');
    expect(iban).toMatch(/^CZ\d{2}0300000000 ?0123456789$/);
    expect(iban).toBe(`CZ${iban!.slice(2, 4)}03000000000123456789`);
    expect(valid(iban!)).toBe(true);
  });

  it('keeps a prefix in its six digits', () => {
    const iban = czIban('19-1234567890', '0800')!;
    expect(iban.slice(4)).toBe('08000000191234567890');
    expect(valid(iban)).toBe(true);
  });

  it('matches a known example of the national format', () => {
    // The Czech National Bank's published sample account 19-2000145399/0800.
    expect(czIban('19-2000145399', '0800')).toBe('CZ6508000000192000145399');
  });

  it('refuses what is not a Czech account', () => {
    expect(czIban('12345678901', '0300')).toBeNull();
    expect(czIban('123', 'CEKOCZPP')).toBeNull();
    expect(czIban('abc', '0300')).toBeNull();
  });

  it('reads the slashed form', () => {
    expect(czIbanOfSlashed('123456789/0300')).toBe(czIban('123456789', '0300'));
    expect(czIbanOfSlashed('123456789')).toBeNull();
  });
});
