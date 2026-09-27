// The database key: 32 random bytes as 64 hex characters, kept only as a safeStorage blob in userData/db-key.bin (0600).
// Invariant: an encrypted database appears on disk only after its key has been written and read back (create()).
// The key is never cached here, never logged, never sent to the renderer.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { DB_KEY_RE } from '../../shared/import-protocol.ts';
import type { SecureStore } from '../secure-store.ts';

export const DB_KEY_FILE = 'db-key.bin';

export type KeyLoad =
  | { kind: 'ok'; key: string }
  | { kind: 'missing' }
  /** The store has no key right now (Keychain «Запретить», keyring locked): may work after a restart. */
  | { kind: 'unavailable' }
  /** Undecryptable for good, or decrypted into something that is not a key. */
  | { kind: 'lost' };

export type KeyCreate = { kind: 'ok'; key: string } | { kind: 'insecure' } | { kind: 'unavailable' };

export class DbKeyVault {
  private readonly file: string;

  constructor(
    private readonly d: {
      store: SecureStore;
      userDataDir: string;
      platform: NodeJS.Platform;
      randomBytes?: (n: number) => Buffer;
    },
  ) {
    this.file = path.join(d.userDataDir, DB_KEY_FILE);
  }

  async load(): Promise<KeyLoad> {
    let blob: Buffer;
    try {
      blob = await fs.promises.readFile(this.file);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return { kind: 'missing' };
      throw err;
    }
    if (blob.length === 0) return { kind: 'lost' };
    const r = await this.d.store.decrypt(blob);
    if (r.kind === 'unavailable') return { kind: 'unavailable' };
    if (r.kind === 'failed' || !DB_KEY_RE.test(r.value)) return { kind: 'lost' };
    if (r.reencrypted) await this.write(r.reencrypted).catch(() => undefined);
    return { kind: 'ok', key: r.value };
  }

  /** A new key, written and read back. The only place an existing file is overwritten. */
  async create(): Promise<KeyCreate> {
    const reliability = await this.d.store.reliability();
    if (reliability !== 'secure') return { kind: reliability };
    const key = (this.d.randomBytes ?? crypto.randomBytes)(32).toString('hex');
    let blob: Buffer | null;
    try {
      blob = await this.d.store.encrypt(key);
    } catch {
      return { kind: 'unavailable' };
    }
    if (!blob) return { kind: 'insecure' };
    await this.write(blob);
    const back = await this.load();
    if (back.kind !== 'ok' || back.key !== key) {
      // Not readable back: never leave a key file an encrypted database could come to depend on.
      await this.clear();
      return { kind: 'unavailable' };
    }
    return { kind: 'ok', key };
  }

  async clear(): Promise<void> {
    await fs.promises.rm(this.file, { force: true });
    await fs.promises.rm(`${this.file}.tmp`, { force: true });
  }

  private async write(blob: Buffer): Promise<void> {
    const tmp = `${this.file}.tmp`;
    try {
      const handle = await fs.promises.open(tmp, 'w', 0o600);
      try {
        await handle.writeFile(blob);
        await handle.sync();
      } finally {
        await handle.close();
      }
      await fs.promises.rename(tmp, this.file);
    } catch (err) {
      await fs.promises.rm(tmp, { force: true });
      throw err;
    }
    await syncDir(this.d.userDataDir, this.d.platform);
  }
}

/** The rename itself durable: fsync of the folder (macOS / Linux; Windows cannot open a folder for this). */
export async function syncDir(dir: string, platform: NodeJS.Platform): Promise<void> {
  if (platform === 'win32') return;
  const handle = await fs.promises.open(dir, 'r');
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
}
