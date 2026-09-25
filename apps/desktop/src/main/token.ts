// The Monobank token in main. It enters once via setToken and never leaves main except to the import worker (step 6):
// no IPC reply, log, error message or database row ever contains it (tests/token.test.ts).
// Persistence only through safeStorage (Keychain / DPAPI / libsecret); with no secure backend — memory only.
import fs from 'node:fs';
import path from 'node:path';
import type { TokenStatus } from '../shared/api.ts';

export type { TokenStatus };

export type SafeStorageLike = {
  isAsyncEncryptionAvailable(): Promise<boolean>;
  encryptStringAsync(plainText: string): Promise<Buffer>;
  decryptStringAsync(encrypted: Buffer): Promise<{ result: string; shouldReEncrypt: boolean }>;
  /** Linux only. */
  getSelectedStorageBackend?(): string;
};

export const TOKEN_FILE = 'token.bin';

/** Same rule as the IPC schema: a token-shaped string, nothing else is kept. */
const TOKEN_RE = /^\S{20,200}$/;

/** Linux backends that are not a secret store: safeStorage "encrypts" with a hard-coded key there. */
const INSECURE_BACKENDS = new Set(['basic_text', 'unknown']);

export class TokenError extends Error {
  override name = 'TokenError';
}

export class TokenStore {
  private memory: string | null = null;
  private needsReentry = false;
  private readonly file: string;

  constructor(private readonly deps: { safeStorage: SafeStorageLike; platform: NodeJS.Platform; userDataDir: string }) {
    this.file = path.join(deps.userDataDir, TOKEN_FILE);
  }

  /** True only for a real OS secret store. */
  async secureStorageAvailable(): Promise<boolean> {
    const { safeStorage, platform } = this.deps;
    if (!(await safeStorage.isAsyncEncryptionAvailable())) return false;
    if (platform === 'linux') {
      const backend = safeStorage.getSelectedStorageBackend?.() ?? 'unknown';
      if (INSECURE_BACKENDS.has(backend)) return false;
    }
    return true;
  }

  async status(): Promise<TokenStatus> {
    const onDisk = fs.existsSync(this.file);
    return {
      present: this.memory !== null || onDisk,
      stored: onDisk ? 'secure' : this.memory !== null ? 'memory' : null,
      secureStorage: await this.secureStorageAvailable(),
      needsReentry: this.needsReentry,
    };
  }

  /** Keeps the token for this session; persists it encrypted only if asked and the store is secure. */
  async set(token: string, remember: boolean): Promise<{ stored: 'secure' | 'memory' }> {
    if (!TOKEN_RE.test(token)) throw new TokenError('Токен не похож на токен Monobank');
    this.memory = token;
    this.needsReentry = false;
    if (remember && (await this.secureStorageAvailable())) {
      const blob = await this.deps.safeStorage.encryptStringAsync(token);
      await fs.promises.mkdir(path.dirname(this.file), { recursive: true });
      const tmp = `${this.file}.tmp`;
      await fs.promises.writeFile(tmp, blob, { mode: 0o600 });
      await fs.promises.rename(tmp, this.file);
      return { stored: 'secure' };
    }
    // Not remembered (or no secure store): an older saved token must not outlive this choice.
    await fs.promises.rm(this.file, { force: true });
    return { stored: 'memory' };
  }

  async clear(): Promise<void> {
    this.memory = null;
    this.needsReentry = false;
    await fs.promises.rm(this.file, { force: true });
    await fs.promises.rm(`${this.file}.tmp`, { force: true });
  }

  /** For main only (the import worker in step 6). Never wire this to IPC. */
  async get(): Promise<string | null> {
    if (this.memory !== null) return this.memory;
    if (!fs.existsSync(this.file)) return null;
    try {
      const { result } = await this.deps.safeStorage.decryptStringAsync(await fs.promises.readFile(this.file));
      if (!TOKEN_RE.test(result)) throw new TokenError('bad token');
      this.memory = result;
      return result;
    } catch {
      // Undecryptable (other machine, rebuilt unsigned app, corrupted): drop it and ask again.
      await fs.promises.rm(this.file, { force: true });
      this.needsReentry = true;
      return null;
    }
  }
}
