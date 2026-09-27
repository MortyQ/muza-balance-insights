// Bank tokens in main, one per connection. A token enters via set and never leaves main except to the import worker:
// no IPC reply, log, error message or database row ever contains it (tests/token.test.ts).
// Persistence only through safeStorage (Keychain / DPAPI / libsecret), one file per connection; with no secure
// backend — memory only.
import fs from 'node:fs';
import path from 'node:path';
import type { TokenStatus } from '../shared/api.ts';
import { DESKTOP_PROVIDERS } from '../net/providers.ts';
import { SecureStore, type SafeStorageLike } from './secure-store.ts';

export type { SafeStorageLike, TokenStatus };

/** tokens/<connectionId>.bin */
export const TOKENS_DIR = 'tokens';
/** The single token before several connections; moved into TOKENS_DIR on launch (migrateLegacy). */
export const LEGACY_TOKEN_FILE = 'token.bin';

type Provider = keyof typeof DESKTOP_PROVIDERS;

/** A decrypted file must look like some provider's credential. */
const ANY_CREDENTIAL = (s: string) => Object.values(DESKTOP_PROVIDERS).some((p) => p.credential.test(s));

export class TokenError extends Error {
  override name = 'TokenError';
}

export class TokenVault {
  private readonly memory = new Map<number, string>();
  private readonly needsReentry = new Set<number>();
  private readonly dir: string;
  private readonly store: SecureStore;

  /** `store`: shared with the database key (one reliability probe per process); tests may leave it out. */
  constructor(private readonly deps: { safeStorage: SafeStorageLike; platform: NodeJS.Platform; userDataDir: string; store?: SecureStore }) {
    this.dir = path.join(deps.userDataDir, TOKENS_DIR);
    this.store = deps.store ?? new SecureStore(deps);
  }

  private file(connectionId: number): string {
    if (!Number.isSafeInteger(connectionId) || connectionId <= 0) throw new TokenError('Неверный id подключения');
    return path.join(this.dir, `${connectionId}.bin`);
  }

  /** True only for a real OS secret store (on Linux: judged by the blob, see secure-store.ts). */
  async secureStorageAvailable(): Promise<boolean> {
    return (await this.store.reliability()) === 'secure';
  }

  async status(connectionId: number): Promise<TokenStatus> {
    // A file that did not decrypt stays on disk (it may open after a restart) but counts as missing.
    const onDisk = fs.existsSync(this.file(connectionId)) && !this.needsReentry.has(connectionId);
    const inMemory = this.memory.has(connectionId);
    return {
      present: inMemory || onDisk,
      stored: onDisk ? 'secure' : inMemory ? 'memory' : null,
      secureStorage: await this.secureStorageAvailable(),
      needsReentry: this.needsReentry.has(connectionId),
    };
  }

  /** Keeps the token for this session; persists it encrypted only if asked and the store is secure. */
  async set(connectionId: number, provider: Provider, token: string, remember: boolean): Promise<{ stored: 'secure' | 'memory' }> {
    const { bank, credential } = DESKTOP_PROVIDERS[provider];
    if (!credential.test(token)) throw new TokenError(`Токен не похож на токен ${bank}`);
    const file = this.file(connectionId);
    this.memory.set(connectionId, token);
    this.needsReentry.delete(connectionId);
    if (remember && (await this.secureStorageAvailable())) {
      const blob = await this.store.encrypt(token);
      if (blob) {
        await this.write(file, blob);
        return { stored: 'secure' };
      }
    }
    // Not remembered (or no secure store): an older saved token must not outlive this choice.
    await fs.promises.rm(file, { force: true });
    return { stored: 'memory' };
  }

  async clear(connectionId: number): Promise<void> {
    const file = this.file(connectionId);
    this.memory.delete(connectionId);
    this.needsReentry.delete(connectionId);
    await fs.promises.rm(file, { force: true });
    await fs.promises.rm(`${file}.tmp`, { force: true });
  }

  /** Every token, in memory and on disk (the legacy file too). */
  async clearAll(): Promise<void> {
    this.memory.clear();
    this.needsReentry.clear();
    await fs.promises.rm(this.dir, { recursive: true, force: true });
    for (const f of [LEGACY_TOKEN_FILE, `${LEGACY_TOKEN_FILE}.tmp`]) await fs.promises.rm(path.join(this.deps.userDataDir, f), { force: true });
  }

  /** For main only (the import worker). Never wire this to IPC. */
  async get(connectionId: number): Promise<string | null> {
    const cached = this.memory.get(connectionId);
    if (cached !== undefined) return cached;
    const file = this.file(connectionId);
    if (!fs.existsSync(file)) return null;
    const r = await this.store.decrypt(await fs.promises.readFile(file));
    if (r.kind !== 'ok') {
      // Not decrypted: keychain access denied («Запретить» after an unsigned update), keychain locked, other machine.
      // The file stays — after a restart and «Разрешить» it opens again; a new token entered meanwhile overwrites it.
      this.needsReentry.add(connectionId);
      return null;
    }
    const result = r.value;
    if (!ANY_CREDENTIAL(result)) {
      // Decrypted, but not a token: the file is damaged, nothing to wait for.
      await fs.promises.rm(file, { force: true });
      this.needsReentry.add(connectionId);
      return null;
    }
    this.needsReentry.delete(connectionId);
    this.memory.set(connectionId, result);
    // The store asked for a fresh blob (its key changed): best effort, the old file still decrypts.
    if (r.reencrypted) await this.write(file, r.reencrypted).catch(() => undefined);
    return result;
  }

  private async write(file: string, blob: Buffer): Promise<void> {
    await fs.promises.mkdir(this.dir, { recursive: true, mode: 0o700 });
    const tmp = `${file}.tmp`;
    await fs.promises.writeFile(tmp, blob, { mode: 0o600 });
    await fs.promises.rename(tmp, file);
  }

  /** Connections with a token saved on disk (an import can resume without asking). */
  async saved(): Promise<number[]> {
    const names = fs.existsSync(this.dir) ? await fs.promises.readdir(this.dir) : [];
    return names.flatMap((n) => (/^[1-9]\d*\.bin$/.test(n) ? [Number(n.slice(0, -4))] : [])).sort((a, b) => a - b);
  }

  hasLegacy(): boolean {
    return fs.existsSync(path.join(this.deps.userDataDir, LEGACY_TOKEN_FILE));
  }

  /**
   * The token of the app before several connections becomes the token of `connectionId` (the only Monobank connection).
   * The encrypted file is moved as it is — never decrypted here. A token already saved for the connection wins.
   */
  async migrateLegacy(connectionId: number): Promise<'moved' | 'dropped' | 'none'> {
    const legacy = path.join(this.deps.userDataDir, LEGACY_TOKEN_FILE);
    await fs.promises.rm(`${legacy}.tmp`, { force: true });
    if (!fs.existsSync(legacy)) return 'none';
    const file = this.file(connectionId);
    if (fs.existsSync(file)) {
      await fs.promises.rm(legacy, { force: true });
      return 'dropped';
    }
    await fs.promises.mkdir(this.dir, { recursive: true, mode: 0o700 });
    await fs.promises.rename(legacy, file);
    return 'moved';
  }
}
