// DbKeyVault on a temp folder with a fake safeStorage: the key round-trips, the file is 0600 and never holds the key in
// the clear, and every way the blob can fail maps to missing / unavailable / lost — nothing is ever deleted on load.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DB_KEY_FILE, DbKeyVault } from '../src/main/db/key-vault.ts';
import { SecureStore, type SafeStorageLike } from '../src/main/secure-store.ts';

const KEY_BYTES = Buffer.alloc(32, 0xc0);
const KEY = KEY_BYTES.toString('hex');

let dir: string;
beforeEach(() => void (dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dbkey-'))));
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

/** Reversible, never the plain text: prefix + reversed base64. `decryptError` simulates the store's failures. */
function fake(o: { prefix?: string; available?: boolean; decryptError?: string; encryptThrows?: boolean; reencrypt?: boolean } = {}): SafeStorageLike {
  const prefix = o.prefix ?? 'v11';
  return {
    isAsyncEncryptionAvailable: async () => o.available ?? true,
    encryptStringAsync: async (s) => {
      if (o.encryptThrows) throw new Error(`encrypt failed for ${s}`);
      return Buffer.from(`${prefix}${[...Buffer.from(s).toString('base64')].reverse().join('')}`);
    },
    decryptStringAsync: async (b) => {
      if (o.decryptError) throw new Error(o.decryptError);
      const body = [...b.toString().slice(3)].reverse().join('');
      return { result: Buffer.from(body, 'base64').toString(), shouldReEncrypt: o.reencrypt ?? false };
    },
  };
}
const vault = (ss: SafeStorageLike, platform: NodeJS.Platform = 'darwin') =>
  new DbKeyVault({ store: new SecureStore({ safeStorage: ss, platform }), userDataDir: dir, platform, randomBytes: () => KEY_BYTES });
const file = () => path.join(dir, DB_KEY_FILE);

describe('DbKeyVault', () => {
  it('create → load: the same key; the file is 0600, no .tmp, and does not contain the key', async () => {
    const v = vault(fake());
    expect(await v.load()).toEqual({ kind: 'missing' });
    expect(await v.create()).toEqual({ kind: 'ok', key: KEY });
    expect(await vault(fake()).load()).toEqual({ kind: 'ok', key: KEY });
    expect(fs.statSync(file()).mode & 0o777).toBe(0o600);
    expect(fs.existsSync(`${file()}.tmp`)).toBe(false);
    expect(fs.readFileSync(file()).includes(Buffer.from(KEY))).toBe(false);
  });

  it('a real key: 64 lowercase hex from 32 random bytes', async () => {
    const v = new DbKeyVault({ store: new SecureStore({ safeStorage: fake(), platform: 'darwin' }), userDataDir: dir, platform: 'darwin' });
    const r = await v.create();
    expect(r.kind === 'ok' && /^[0-9a-f]{64}$/.test(r.key)).toBe(true);
  });

  it('no secure store: create writes nothing — insecure (Linux v10, not available) / unavailable (probe throws)', async () => {
    expect(await vault(fake({ prefix: 'v10' }), 'linux').create()).toEqual({ kind: 'insecure' });
    expect(await vault(fake({ available: false })).create()).toEqual({ kind: 'insecure' });
    expect(await vault(fake({ encryptThrows: true }), 'linux').create()).toEqual({ kind: 'unavailable' });
    expect(fs.existsSync(file())).toBe(false);
  });

  it('load failures keep the file: «temporarily unavailable» → unavailable; any other → lost; not a key → lost', async () => {
    await vault(fake()).create();
    expect(await vault(fake({ decryptError: 'the encryption key is temporarily unavailable' })).load()).toEqual({ kind: 'unavailable' });
    expect(await vault(fake({ decryptError: 'Error while decrypting' })).load()).toEqual({ kind: 'lost' });
    expect(fs.existsSync(file())).toBe(true);
    fs.writeFileSync(file(), await fake().encryptStringAsync('not a key'));
    expect(await vault(fake()).load()).toEqual({ kind: 'lost' });
    fs.writeFileSync(file(), '');
    expect(await vault(fake()).load()).toEqual({ kind: 'lost' });
    expect(fs.existsSync(file())).toBe(true);
  });

  it('a key that does not read back is not kept (create → unavailable, no file)', async () => {
    const ss = { ...fake(), decryptStringAsync: async () => ({ result: 'f'.repeat(64), shouldReEncrypt: false }) };
    expect(await vault(ss).create()).toEqual({ kind: 'unavailable' });
    expect(fs.existsSync(file())).toBe(false);
  });

  it('shouldReEncrypt: the file is rewritten, the key stays the same', async () => {
    await vault(fake({ prefix: 'v11' }), 'linux').create();
    expect(await vault(fake({ prefix: 'v12', reencrypt: true }), 'linux').load()).toEqual({ kind: 'ok', key: KEY });
    expect(fs.readFileSync(file()).subarray(0, 3).toString()).toBe('v12');
  });

  it('clear removes the key and a leftover .tmp', async () => {
    const v = vault(fake());
    await v.create();
    fs.writeFileSync(`${file()}.tmp`, 'x');
    await v.clear();
    expect(fs.readdirSync(dir)).toEqual([]);
  });

  it('db-key.bin writes nowhere else and logs nothing', () => {
    const code = fs.readFileSync(new URL('../src/main/db/key-vault.ts', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
    expect(code).not.toMatch(/console\.|process\.std(out|err)|@mono\/|electron/);
  });
});
