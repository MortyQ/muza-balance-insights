// SecureStore: whether safeStorage is a real OS secret store (Linux: by the blob's prefix, not the reported backend) and
// what a failed decrypt means. safeStorage is a fake; the texts are Electron 44's (not checked on a live system).
import { describe, expect, it } from 'vitest';
import { SecureStore, blobReliable, classifyDecryptError, type SafeStorageLike } from '../src/main/secure-store.ts';

const fake = (o: { prefix?: string; available?: boolean; encryptThrows?: boolean; decrypt?: SafeStorageLike['decryptStringAsync'] } = {}) => {
  const calls = { encrypt: 0 };
  const ss: SafeStorageLike = {
    isAsyncEncryptionAvailable: async () => o.available ?? true,
    encryptStringAsync: async (s) => {
      calls.encrypt++;
      if (o.encryptThrows) throw new Error('keyring did not answer');
      return Buffer.from(`${o.prefix ?? 'v11'}${s}`);
    },
    decryptStringAsync: o.decrypt ?? (async (b) => ({ result: b.toString().slice(3), shouldReEncrypt: false })),
  };
  return { ss, calls };
};

describe('blobReliable', () => {
  it('Linux: only v11 / v12; macOS and Windows: any non-empty blob', () => {
    expect(blobReliable(Buffer.from('v11abc'), 'linux')).toBe(true);
    expect(blobReliable(Buffer.from('v12abc'), 'linux')).toBe(true);
    expect(blobReliable(Buffer.from('v10abc'), 'linux')).toBe(false);
    expect(blobReliable(Buffer.from('abc'), 'linux')).toBe(false);
    expect(blobReliable(Buffer.from('v10abc'), 'darwin')).toBe(true);
    expect(blobReliable(Buffer.from('anything'), 'win32')).toBe(true);
    expect(blobReliable(Buffer.alloc(0), 'win32')).toBe(false);
  });
});

describe('classifyDecryptError', () => {
  it('«temporarily unavailable» → unavailable; anything else → failed', () => {
    expect(classifyDecryptError(new Error('Decryption failed: the encryption key is temporarily unavailable.'))).toBe('unavailable');
    expect(classifyDecryptError(new Error('Error while decrypting the ciphertext provided to safeStorage.decryptString.'))).toBe('failed');
    expect(classifyDecryptError('not an error')).toBe('failed');
  });
});

describe('reliability', () => {
  it('Linux: v10 (built-in key) is insecure even though encryption is "available"', async () => {
    expect(await new SecureStore({ safeStorage: fake({ prefix: 'v10' }).ss, platform: 'linux' }).reliability()).toBe('insecure');
    expect(await new SecureStore({ safeStorage: fake({ prefix: 'v11' }).ss, platform: 'linux' }).reliability()).toBe('secure');
  });

  it('not available → insecure; macOS / Windows do not probe', async () => {
    expect(await new SecureStore({ safeStorage: fake({ available: false }).ss, platform: 'darwin' }).reliability()).toBe('insecure');
    const f = fake();
    expect(await new SecureStore({ safeStorage: f.ss, platform: 'win32' }).reliability()).toBe('secure');
    expect(f.calls.encrypt).toBe(0);
  });

  it('a probe that throws is unavailable and asked again; a known result is cached', async () => {
    const failing = new SecureStore({ safeStorage: fake({ encryptThrows: true }).ss, platform: 'linux' });
    expect(await failing.reliability()).toBe('unavailable');
    const f = fake({ prefix: 'v11' });
    const ok = new SecureStore({ safeStorage: f.ss, platform: 'linux' });
    await ok.reliability();
    await ok.reliability();
    expect(f.calls.encrypt).toBe(1);
  });

  it('an unreliable blob from encrypt() is not returned and makes the store insecure', async () => {
    let prefix = 'v11';
    const ss: SafeStorageLike = { ...fake().ss, encryptStringAsync: async (s) => Buffer.from(`${prefix}${s}`) };
    const store = new SecureStore({ safeStorage: ss, platform: 'linux' });
    expect(await store.reliability()).toBe('secure');
    prefix = 'v10'; // the keyring stopped answering mid-session
    expect(await store.encrypt('x')).toBeNull();
    expect(await store.reliability()).toBe('insecure');
  });
});

describe('decrypt', () => {
  it('ok / unavailable / failed', async () => {
    const ok = new SecureStore({ safeStorage: fake().ss, platform: 'darwin' });
    expect(await ok.decrypt(Buffer.from('v11value'))).toEqual({ kind: 'ok', value: 'value', reencrypted: null });
    const denied = fake({ decrypt: async () => { throw new Error('the encryption key is temporarily unavailable'); } });
    expect(await new SecureStore({ safeStorage: denied.ss, platform: 'darwin' }).decrypt(Buffer.from('x'))).toEqual({ kind: 'unavailable' });
    const broken = fake({ decrypt: async () => { throw new Error('Error while decrypting'); } });
    expect(await new SecureStore({ safeStorage: broken.ss, platform: 'darwin' }).decrypt(Buffer.from('x'))).toEqual({ kind: 'failed' });
  });

  it('shouldReEncrypt: a fresh reliable blob; an unreliable or failing one → null, the value still returned', async () => {
    const reenc = (prefix: string, encryptThrows = false) =>
      new SecureStore({
        safeStorage: fake({ prefix, encryptThrows, decrypt: async () => ({ result: 'value', shouldReEncrypt: true }) }).ss,
        platform: 'linux',
      }).decrypt(Buffer.from('old'));
    expect(await reenc('v12')).toEqual({ kind: 'ok', value: 'value', reencrypted: Buffer.from('v12value') });
    expect(await reenc('v10')).toEqual({ kind: 'ok', value: 'value', reencrypted: null });
    expect(await reenc('v11', true)).toEqual({ kind: 'ok', value: 'value', reencrypted: null });
  });
});
