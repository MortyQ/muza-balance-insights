// The one place that knows whether the database is encrypted and holds its key. Decides at launch (init), before
// anything else opens the file, what state the database is in — and never deletes a database itself: a key that is
// missing or not readable only sets the state. DataService opens through open(), the import worker gets forWorker();
// neither sees how the key is kept. The key never reaches a log line, an error message or the renderer.
import fs from 'node:fs';
import path from 'node:path';
import type { Db } from '@mono/core/db';
import type { DbStateView } from '../../shared/db-state.ts';
import type { SecureStore } from '../secure-store.ts';
import { encryptingFiles } from './encrypt.ts';
import { dbFileKind } from './header.ts';
import type { DbKeyVault } from './key-vault.ts';

export const DB_FILE = 'monobank.db';
/** The encrypted copy while a plain database is being encrypted (encrypt.ts); a leftover means an interrupted run. */
export const ENCRYPTING_FILE = `${DB_FILE}.encrypting`;
/** The database with everything SQLite and the migration can leave next to it. */
export const DB_FILES = [DB_FILE, `${DB_FILE}-wal`, `${DB_FILE}-shm`, `${DB_FILE}-journal`] as const;

/** `no-secure-storage`: nowhere to keep a key (Linux without a keyring) — plain for good. `encrypt-pending`: plain for now, retried next launch. */
export type DbNotice = 'no-secure-storage' | 'encrypt-pending';
export type DbState =
  | { kind: 'ready'; encrypted: boolean; notice: DbNotice | null }
  | { kind: 'key-unavailable' }
  | { kind: 'key-lost' }
  | { kind: 'db-unreadable' };

export type EncryptResult = { ok: true } | { ok: false; step: string };

export class DbOpenError extends Error {
  override name = 'DbOpenError';
  constructor(readonly kind: 'unavailable' | 'unreadable') {
    super(kind === 'unavailable' ? 'Database unavailable' : 'Database cannot be opened');
  }
}

export type DbAccessDeps = {
  userDataDir: string;
  keys: Pick<DbKeyVault, 'load' | 'create' | 'clear'>;
  store: Pick<SecureStore, 'reliability'>;
  openDb: (url: string, opts?: { encryptionKey?: string }) => Promise<Db>;
  /** After close, before a delete: closed databases hold their files until collected (releaseClosedFiles). */
  release: () => Promise<unknown>;
  /** Plain → encrypted, in place (encrypt.ts). Absent: a plain database stays plain (`encrypt-pending`). */
  encrypt?: (file: string, key: string) => Promise<EncryptResult>;
  onChange?: (state: DbState) => void;
  log: (msg: string) => void;
};

const NOT_A_DB = /SQLITE_NOTADB|file is not a database/i;
const notADatabase = (err: unknown) => err instanceof Error && (NOT_A_DB.test(err.message) || (err as { code?: unknown }).code === 'SQLITE_NOTADB');

export class DbAccess {
  private current: DbState = { kind: 'db-unreadable' };
  private key: string | null = null;
  private readonly file: string;

  constructor(private readonly d: DbAccessDeps) {
    this.file = path.join(d.userDataDir, DB_FILE);
  }

  state(): DbState {
    return this.current;
  }

  isReady(): boolean {
    return this.current.kind === 'ready';
  }

  /** For the renderer: enums and booleans only (shared/db-state.ts). */
  view(platform: NodeJS.Platform): DbStateView {
    const s = this.current;
    const p = platform === 'darwin' || platform === 'win32' || platform === 'linux' ? platform : 'other';
    if (s.kind !== 'ready') return { status: s.kind, encrypted: false, notice: null, platform: p };
    return { status: 'ready', encrypted: s.encrypted, notice: s.notice, platform: p };
  }

  get dbPath(): string {
    return this.file;
  }

  async init(): Promise<DbState> {
    this.key = null;
    for (const f of encryptingFiles(this.file)) await fs.promises.rm(f, { force: true });
    const next = await this.decide();
    this.set(next);
    this.d.log(next.kind === 'ready' ? `state=ready encrypted=${next.encrypted}${next.notice ? ` notice=${next.notice}` : ''}` : `state=${next.kind}`);
    return next;
  }

  /** For DataService. Not ready → DbOpenError('unavailable'); a key that stops fitting → db-unreadable. */
  async open(): Promise<Db> {
    if (!this.isReady()) throw new DbOpenError('unavailable');
    try {
      return await this.d.openDb(this.url(), this.key ? { encryptionKey: this.key } : {});
    } catch (err) {
      if (!notADatabase(err)) throw err;
      this.key = null;
      this.set({ kind: 'db-unreadable' });
      this.d.log('state=db-unreadable');
      throw new DbOpenError('unreadable');
    }
  }

  /** For the import worker: the path and the key (null for a plain database). Not ready → null. */
  forWorker(): { dbPath: string; dbKey: string | null } | null {
    return this.isReady() ? { dbPath: this.file, dbKey: this.key } : null;
  }

  /** After «Удалить все данные»: no key and no database — decided again (a fresh install gets a new key). */
  async afterWipe(): Promise<DbState> {
    return this.init();
  }

  /**
   * «Начать заново» only (start-over.ts, after the user confirmed and nothing holds the file): the key first — a
   * database file that fails to go is unreadable already — then the database, then decided again as a fresh install.
   */
  async reset(): Promise<DbState> {
    this.key = null;
    await this.d.keys.clear();
    await this.d.release();
    for (const f of [...DB_FILES.map((n) => path.join(this.d.userDataDir, n)), ...encryptingFiles(this.file)]) {
      await fs.promises.rm(f, { force: true });
    }
    return this.init();
  }

  private url(): string {
    return `file:${this.file}`;
  }

  private set(next: DbState): void {
    this.current = next;
    this.d.onChange?.(next);
  }

  private plain(notice: DbNotice | null): DbState {
    this.key = null;
    return { kind: 'ready', encrypted: false, notice };
  }

  private encrypted(key: string): DbState {
    this.key = key;
    return { kind: 'ready', encrypted: true, notice: null };
  }

  private async noticeFor(): Promise<DbNotice> {
    return (await this.d.store.reliability()) === 'insecure' ? 'no-secure-storage' : 'encrypt-pending';
  }

  private async decide(): Promise<DbState> {
    const kind = await dbFileKind(this.file);
    if (kind === 'other') return this.decideEncrypted();
    const loaded = await this.d.keys.load();
    if (kind === 'missing') {
      // No data yet: nothing to lose. A key that does not load is replaced.
      if (loaded.kind === 'ok') return this.encrypted(loaded.key);
      if (loaded.kind === 'unavailable') return this.plain('encrypt-pending');
      const created = await this.d.keys.create();
      if (created.kind === 'ok') return this.encrypted(created.key);
      return this.plain(created.kind === 'insecure' ? 'no-secure-storage' : 'encrypt-pending');
    }
    // plain: an existing unencrypted database (before 0.1.4, a failed migration, or no keyring).
    if ((await this.d.store.reliability()) !== 'secure') return this.plain(await this.noticeFor());
    let key: string;
    if (loaded.kind === 'ok') key = loaded.key;
    else if (loaded.kind === 'unavailable') return this.plain('encrypt-pending');
    else {
      const created = await this.d.keys.create();
      if (created.kind !== 'ok') return this.plain(created.kind === 'insecure' ? 'no-secure-storage' : 'encrypt-pending');
      key = created.key;
    }
    if (!this.d.encrypt) return this.plain('encrypt-pending');
    const r = await this.d.encrypt(this.file, key);
    if (!r.ok) {
      this.d.log(`encrypt failed at step=${r.step}`);
      return this.plain('encrypt-pending');
    }
    return this.encrypted(key);
  }

  /** An encrypted (or unrecognisable) file: only its key opens it; nothing is created, changed or removed. */
  private async decideEncrypted(): Promise<DbState> {
    const loaded = await this.d.keys.load();
    if (loaded.kind === 'unavailable') return { kind: 'key-unavailable' };
    if (loaded.kind !== 'ok') return { kind: 'key-lost' };
    try {
      const db = await this.d.openDb(this.url(), { encryptionKey: loaded.key });
      try {
        await db.execute('SELECT COUNT(*) FROM sqlite_schema');
      } finally {
        db.close();
      }
    } catch (err) {
      if (notADatabase(err)) return { kind: 'db-unreadable' };
      throw err;
    }
    return this.encrypted(loaded.key);
  }
}
