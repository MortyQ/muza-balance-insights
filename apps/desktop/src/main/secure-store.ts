// safeStorage for everything main keeps encrypted (bank tokens now, the database key next): whether the store is a real
// OS secret store, and what a failed decrypt means. No electron import — safeStorage comes from index.ts.

export type SafeStorageLike = {
  isAsyncEncryptionAvailable(): Promise<boolean>;
  encryptStringAsync(plainText: string): Promise<Buffer>;
  decryptStringAsync(encrypted: Buffer): Promise<{ result: string; shouldReEncrypt: boolean }>;
};

/** `unavailable`: the probe itself failed (keyring not answering) — not cached, asked again next time. */
export type Reliability = 'secure' | 'insecure' | 'unavailable';

export type Decrypted =
  /** `reencrypted`: a fresh blob when the store asked for it (shouldReEncrypt) and it is reliable; the caller rewrites. */
  | { kind: 'ok'; value: string; reencrypted: Buffer | null }
  /** The provider has no key right now: Keychain access denied, keyring locked. May work after a restart. */
  | { kind: 'unavailable' }
  /** Another provider key, a damaged blob. */
  | { kind: 'failed' };

const PROBE = 'balance-insights-probe';

/**
 * Linux: the async API silently falls back to a built-in key (`v10`) when no keyring answers, while
 * isAsyncEncryptionAvailable() still says true — only `v11` (Secret Service / KWallet) and `v12` (Secret Portal) are a
 * real store. macOS and Windows: any blob that encrypted is (Keychain / DPAPI).
 */
export function blobReliable(blob: Buffer, platform: NodeJS.Platform): boolean {
  if (platform !== 'linux') return blob.length > 0;
  const prefix = blob.subarray(0, 3).toString('latin1');
  return prefix === 'v11' || prefix === 'v12';
}

/** By Electron 44's messages (not checked on a live system): a missing key is «temporarily unavailable». */
export function classifyDecryptError(err: unknown): 'unavailable' | 'failed' {
  return err instanceof Error && /temporarily unavailable/i.test(err.message) ? 'unavailable' : 'failed';
}

export class SecureStore {
  private known: Promise<Reliability> | null = null;

  constructor(private readonly deps: { safeStorage: SafeStorageLike; platform: NodeJS.Platform }) {}

  reliability(): Promise<Reliability> {
    this.known ??= this.probe().then((r) => {
      if (r === 'unavailable') this.known = null;
      return r;
    });
    return this.known;
  }

  /** A blob that turned out unreliable is not written anywhere: from now on the store counts as insecure. */
  markInsecure(): void {
    this.known = Promise.resolve('insecure');
  }

  /** Throws what safeStorage throws; null — the blob is not from a real secret store, write nothing. */
  async encrypt(plain: string): Promise<Buffer | null> {
    const blob = await this.deps.safeStorage.encryptStringAsync(plain);
    if (blobReliable(blob, this.deps.platform)) return blob;
    this.markInsecure();
    return null;
  }

  async decrypt(blob: Buffer): Promise<Decrypted> {
    let r: { result: string; shouldReEncrypt: boolean };
    try {
      r = await this.deps.safeStorage.decryptStringAsync(blob);
    } catch (err) {
      return { kind: classifyDecryptError(err) };
    }
    let reencrypted: Buffer | null = null;
    if (r.shouldReEncrypt) {
      // The value is good either way; a failed re-encryption only leaves the old file in place.
      reencrypted = await this.encrypt(r.result).catch(() => null);
    }
    return { kind: 'ok', value: r.result, reencrypted };
  }

  private async probe(): Promise<Reliability> {
    const { safeStorage, platform } = this.deps;
    if (!(await safeStorage.isAsyncEncryptionAvailable())) return 'insecure';
    // Only Linux needs to see a real blob: elsewhere availability is the store itself.
    if (platform !== 'linux') return 'secure';
    try {
      return blobReliable(await safeStorage.encryptStringAsync(PROBE), platform) ? 'secure' : 'insecure';
    } catch {
      return 'unavailable';
    }
  }
}
