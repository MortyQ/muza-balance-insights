import crypto from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { KDF, KEY_LEN, hashPin, verifyPin } from '../src/main/lock/pin.ts';

function scrypt(pin: string, salt: Buffer, keylen: number, o: { N: number; r: number; p: number }): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    crypto.scrypt(pin, salt, keylen, o, (err, key) => (err ? reject(err) : resolve(key))),
  );
}

describe('hashPin / verifyPin', () => {
  it('the right PIN verifies, a wrong one does not', async () => {
    const h = await hashPin('2580');
    expect(await verifyPin('2580', h)).toBe(true);
    expect(await verifyPin('2581', h)).toBe(false);
    expect(await verifyPin('', h)).toBe(false);
  });

  it('stores the KDF parameters and a random salt; never the PIN', async () => {
    const a = await hashPin('2580');
    const b = await hashPin('2580');
    expect(a.kdf).toMatchObject({ name: 'scrypt', N: KDF.N, r: KDF.r, p: KDF.p });
    expect(Buffer.from(a.kdf.salt, 'base64')).toHaveLength(16);
    expect(Buffer.from(a.hash, 'base64')).toHaveLength(32);
    expect(a.kdf.salt).not.toBe(b.kdf.salt);
    expect(a.hash).not.toBe(b.hash);
    expect(JSON.stringify(a)).not.toContain('2580');
  });

  it('the same salt gives the same hash (deterministic)', async () => {
    const salt = Buffer.alloc(16, 7);
    expect((await hashPin('2580', salt)).hash).toBe((await hashPin('2580', salt)).hash);
  });

  it('verifies with the parameters stored in the record, not the current defaults', async () => {
    const h = await hashPin('2580');
    const older = { ...h, kdf: { ...h.kdf, N: 16384 } };
    expect(await verifyPin('2580', older)).toBe(false); // hash was made with N = KDF.N

    // The positive side: a record genuinely made with older (still valid) params must verify fine —
    // verifyPin has to use the params from the record, not the current KDF defaults.
    const salt = Buffer.alloc(16, 9);
    const key = await scrypt('2580', salt, KEY_LEN, { N: 16384, r: 8, p: 1 });
    const record = { kdf: { name: 'scrypt' as const, N: 16384, r: 8, p: 1, salt: salt.toString('base64') }, hash: key.toString('base64') };
    expect(await verifyPin('2580', record)).toBe(true);
  });

  it('a mismatched (e.g. empty) stored hash never verifies', async () => {
    const h = await hashPin('2580');
    expect(await verifyPin('2580', { ...h, hash: '' })).toBe(false);
  });
});
