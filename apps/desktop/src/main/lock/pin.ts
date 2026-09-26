// PIN → scrypt hash and back. The PIN itself is never stored or logged; comparison is constant-time.
import crypto from 'node:crypto';

export const KDF = { name: 'scrypt', N: 32768, r: 8, p: 1 } as const;
export const KEY_LEN = 32;
export const SALT_LEN = 16;
// 128·N·r = 32 MiB for these parameters — exactly Node's default limit, which it treats as exceeded.
const MAXMEM = 64 * 1024 * 1024;

export type PinHash = { kdf: { name: 'scrypt'; N: number; r: number; p: number; salt: string }; hash: string };

function scrypt(pin: string, salt: Buffer, len: number, o: { N: number; r: number; p: number }): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    crypto.scrypt(pin, salt, len, { ...o, maxmem: MAXMEM }, (err, key) => (err ? reject(err) : resolve(key))),
  );
}

export async function hashPin(pin: string, salt: Buffer = crypto.randomBytes(16)): Promise<PinHash> {
  const key = await scrypt(pin, salt, KEY_LEN, KDF);
  return { kdf: { ...KDF, salt: salt.toString('base64') }, hash: key.toString('base64') };
}

export async function verifyPin(pin: string, stored: PinHash): Promise<boolean> {
  const expected = Buffer.from(stored.hash, 'base64');
  // A mismatched (e.g. empty) stored hash must never verify — checked before deriving anything.
  if (expected.length !== KEY_LEN) return false;
  const { N, r, p, salt } = stored.kdf;
  const key = await scrypt(pin, Buffer.from(salt, 'base64'), expected.length, { N, r, p });
  return key.length === expected.length && crypto.timingSafeEqual(key, expected);
}
