// DbAccess.init on real libsql files in a temp folder: each row of the launch-state table (spec «Определение состояния
// при запуске»). Rows that end in key-unavailable / key-lost / db-unreadable change no file at all (hashes before/after).
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Db } from '@mono/core/db';
import { openLibsql } from '@mono/db-libsql';
import { DB_FILE, DbAccess, DbOpenError, ENCRYPTING_FILE, type DbAccessDeps, type DbState, type EncryptResult } from '../src/main/db/access.ts';
import { encryptDatabase } from '../src/main/db/encrypt.ts';
import type { KeyCreate, KeyLoad } from '../src/main/db/key-vault.ts';
import type { Reliability } from '../src/main/secure-store.ts';

const KEY = 'c0ffee'.padEnd(64, '0');
const NEW_KEY = 'beef'.padEnd(64, '1');

let dir: string;
const opened: Db[] = [];
beforeEach(() => void (dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dbaccess-'))));
afterEach(() => {
  for (const db of opened.splice(0)) db.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

const file = () => path.join(dir, DB_FILE);
const hashes = () =>
  Object.fromEntries(fs.readdirSync(dir).map((f) => [f, crypto.createHash('sha256').update(fs.readFileSync(path.join(dir, f))).digest('hex')]));

async function makeDb(key?: string) {
  const db = await openLibsql(`file:${file()}`, key ? { encryptionKey: key } : {});
  await db.execute('CREATE TABLE t (x TEXT)');
  await db.execute("INSERT INTO t VALUES ('row')");
  // No -wal / -shm left behind: their removal on close must not race the «unchanged files» hashes below.
  await db.execute('PRAGMA journal_mode = DELETE');
  db.close();
}

function access(o: { load?: KeyLoad; create?: KeyCreate; reliability?: Reliability; encrypt?: DbAccessDeps['encrypt'] } = {}) {
  const calls = { create: 0, encrypt: 0, clear: 0 };
  const logs: string[] = [];
  const changes: DbState[] = [];
  let load = o.load;
  const a = new DbAccess({
    userDataDir: dir,
    keys: {
      load: async () => load ?? { kind: 'missing' },
      create: async () => (calls.create++, o.create ?? { kind: 'ok', key: NEW_KEY }),
      clear: async () => void (calls.clear++, (load = undefined)),
    },
    store: { reliability: async () => o.reliability ?? 'secure' },
    openDb: async (url, opts) => {
      const db = await openLibsql(url, opts);
      opened.push(db);
      return db;
    },
    ...(o.encrypt ? { encrypt: async (f: string, k: string) => (calls.encrypt++, o.encrypt!(f, k)) } : {}),
    onChange: (s) => void changes.push(s),
    log: (m) => void logs.push(m),
  });
  return { a, calls, logs, changes };
}

const ready = (encrypted: boolean, notice: string | null = null) => ({ kind: 'ready', encrypted, notice });

describe('DbAccess.init — no database yet', () => {
  it('1: secure store → a new key; the file is created encrypted', async () => {
    const { a, calls } = access();
    expect(await a.init()).toEqual(ready(true));
    expect(calls.create).toBe(1);
    await (await a.open()).execute('CREATE TABLE t (x)');
    expect(fs.readFileSync(file()).subarray(0, 15).toString('latin1')).not.toBe('SQLite format 3');
    expect(a.forWorker()).toEqual({ dbPath: file(), dbKey: NEW_KEY });
  });

  it('2: no secure store → plain, no-secure-storage', async () => {
    const { a } = access({ create: { kind: 'insecure' } });
    expect(await a.init()).toEqual(ready(false, 'no-secure-storage'));
    expect(a.forWorker()).toEqual({ dbPath: file(), dbKey: null });
  });

  it('3: store unavailable → plain, encrypt-pending', async () => {
    expect(await access({ create: { kind: 'unavailable' } }).a.init()).toEqual(ready(false, 'encrypt-pending'));
  });

  it('4: a key file already there: ok → used; lost → replaced (no data to lose); unavailable → plain for now', async () => {
    const ok = access({ load: { kind: 'ok', key: KEY } });
    expect(await ok.a.init()).toEqual(ready(true));
    expect(ok.calls.create).toBe(0);
    const lost = access({ load: { kind: 'lost' } });
    expect(await lost.a.init()).toEqual(ready(true));
    expect(lost.calls.create).toBe(1);
    expect(await access({ load: { kind: 'unavailable' } }).a.init()).toEqual(ready(false, 'encrypt-pending'));
  });

  it('a 0-byte file counts as missing', async () => {
    fs.writeFileSync(file(), '');
    expect(await access().a.init()).toEqual(ready(true));
  });
});

describe('DbAccess.init — a plain database', () => {
  const ok: EncryptResult = { ok: true };

  it('5: no key yet → a new key → encrypt', async () => {
    await makeDb();
    const { a, calls } = access({ encrypt: async () => ok });
    expect(await a.init()).toEqual(ready(true));
    expect([calls.create, calls.encrypt]).toEqual([1, 1]);
  });

  it('6: key already there (crash between key and migration) → encrypt with it; lost → new key', async () => {
    await makeDb();
    const seen: string[] = [];
    const withKey = access({ load: { kind: 'ok', key: KEY }, encrypt: async (_f, k) => (seen.push(k), ok) });
    expect(await withKey.a.init()).toEqual(ready(true));
    expect(seen).toEqual([KEY]);
    expect(withKey.calls.create).toBe(0);
    const lost = access({ load: { kind: 'lost' }, encrypt: async () => ok });
    expect(await lost.a.init()).toEqual(ready(true));
    expect(lost.calls.create).toBe(1);
  });

  it('with the real migration: the plain database opens encrypted afterwards, rows kept', async () => {
    await makeDb();
    const { a } = access({
      encrypt: (f, k) => encryptDatabase({ file: f, key: k, openDb: (u, o) => openLibsql(u, o), platform: process.platform, log: () => undefined }),
    });
    expect(await a.init()).toEqual(ready(true));
    expect(fs.readFileSync(file()).subarray(0, 15).toString('latin1')).not.toBe('SQLite format 3');
    expect((await (await a.open()).execute('SELECT x FROM t')).rows[0]?.x).toBe('row');
  });

  it('a failed migration → plain, encrypt-pending, the step in the log', async () => {
    await makeDb();
    const { a, logs } = access({ encrypt: async () => ({ ok: false, step: 'copy' }) });
    expect(await a.init()).toEqual(ready(false, 'encrypt-pending'));
    expect(logs).toContain('encrypt failed at step=copy');
    expect(a.forWorker()?.dbKey).toBeNull();
  });

  it('no migration wired yet → plain, encrypt-pending', async () => {
    await makeDb();
    expect(await access().a.init()).toEqual(ready(false, 'encrypt-pending'));
  });

  it('7: insecure store → plain, no-secure-storage, no key created, no migration', async () => {
    await makeDb();
    const { a, calls } = access({ reliability: 'insecure', encrypt: async () => ok });
    expect(await a.init()).toEqual(ready(false, 'no-secure-storage'));
    expect([calls.create, calls.encrypt]).toEqual([0, 0]);
  });

  it('8: store unavailable → plain, encrypt-pending', async () => {
    await makeDb();
    const { a, calls } = access({ reliability: 'unavailable', encrypt: async () => ok });
    expect(await a.init()).toEqual(ready(false, 'encrypt-pending'));
    expect(calls.encrypt).toBe(0);
  });
});

describe('DbAccess.init — an encrypted (or unrecognisable) file: nothing is created, changed or removed', () => {
  it('10: the key opens it → ready, encrypted', async () => {
    await makeDb(KEY);
    const { a } = access({ load: { kind: 'ok', key: KEY } });
    expect(await a.init()).toEqual(ready(true));
    expect((await (await a.open()).execute('SELECT x FROM t')).rows[0]?.x).toBe('row');
  });

  it.each([
    ['9: no key file', { kind: 'missing' }, 'key-lost'],
    ['11: key unavailable', { kind: 'unavailable' }, 'key-unavailable'],
    ['12: key lost', { kind: 'lost' }, 'key-lost'],
    ['10: a key that does not fit', { kind: 'ok', key: NEW_KEY }, 'db-unreadable'],
  ] as const)('%s → %s, every file unchanged', async (_, load, kind) => {
    await makeDb(KEY);
    const before = hashes();
    const { a, calls } = access({ load });
    expect(await a.init()).toEqual({ kind });
    expect(calls.create).toBe(0);
    expect(hashes()).toEqual(before);
    expect(a.forWorker()).toBeNull();
    await expect(a.open()).rejects.toBeInstanceOf(DbOpenError);
  });

  it('garbage in place of the database is not touched either', async () => {
    fs.writeFileSync(file(), 'not a database at all, just text');
    const before = hashes();
    expect(await access().a.init()).toEqual({ kind: 'key-lost' });
    expect(hashes()).toEqual(before);
  });
});

describe('DbAccess — around init', () => {
  it('a leftover of an interrupted encryption is removed first', async () => {
    fs.writeFileSync(path.join(dir, ENCRYPTING_FILE), 'half');
    fs.writeFileSync(path.join(dir, `${ENCRYPTING_FILE}-journal`), 'half');
    await access().a.init();
    expect(fs.existsSync(path.join(dir, ENCRYPTING_FILE))).toBe(false);
    expect(fs.existsSync(path.join(dir, `${ENCRYPTING_FILE}-journal`))).toBe(false);
  });

  it('logs the state, never the key; onChange gets every state', async () => {
    const { a, logs, changes } = access({ load: { kind: 'ok', key: KEY } });
    await a.init();
    expect(logs).toEqual(['state=ready encrypted=true']);
    expect(changes).toEqual([ready(true)]);
    expect(JSON.stringify(logs)).not.toContain(KEY);
  });

  it('afterWipe: key and database gone → decided again (a new key)', async () => {
    const { a, calls } = access();
    await a.init();
    fs.rmSync(file(), { force: true });
    expect(await a.afterWipe()).toEqual(ready(true));
    expect(calls.create).toBe(2);
  });
});

describe('DbAccess.view — what the renderer gets', () => {
  it('enums and booleans only, never the key; platform folded to four values', async () => {
    const { a } = access({ load: { kind: 'ok', key: KEY } });
    await makeDb(KEY);
    await a.init();
    expect(a.view('darwin')).toEqual({ status: 'ready', encrypted: true, notice: null, platform: 'darwin' });
    expect(a.view('freebsd').platform).toBe('other');
    expect(JSON.stringify(a.view('win32'))).not.toContain(KEY);
  });

  it.each([
    [{ kind: 'unavailable' }, 'key-unavailable'],
    [{ kind: 'lost' }, 'key-lost'],
    [{ kind: 'ok', key: NEW_KEY }, 'db-unreadable'],
  ] as const)('not ready (%j) → status %s, encrypted false, no notice', async (load, status) => {
    await makeDb(KEY);
    const { a } = access({ load });
    await a.init();
    const v = a.view('linux');
    expect(v).toEqual({ status, encrypted: false, notice: null, platform: 'linux' });
    for (const x of Object.values(v)) expect(['string', 'boolean', 'object']).toContain(typeof x);
    expect(JSON.stringify(v)).not.toContain(KEY);
  });

  it('plain with a notice', async () => {
    const { a } = access({ reliability: 'insecure', create: { kind: 'insecure' } });
    await a.init();
    expect(a.view('linux')).toEqual({ status: 'ready', encrypted: false, notice: 'no-secure-storage', platform: 'linux' });
  });
});

describe('DbAccess.reset («Начать заново»)', () => {
  it('key-lost: the key and every database file go, a new empty encrypted database with a new key', async () => {
    await makeDb(KEY);
    for (const f of [`${DB_FILE}-wal`, `${DB_FILE}-journal`, ENCRYPTING_FILE]) fs.writeFileSync(path.join(dir, f), 'x');
    const { a, calls } = access({ load: { kind: 'lost' } });
    expect(await a.init()).toEqual({ kind: 'key-lost' });
    expect(await a.reset()).toEqual(ready(true));
    expect(calls.clear).toBe(1);
    expect(calls.create).toBe(1);
    expect(a.forWorker()).toEqual({ dbPath: file(), dbKey: NEW_KEY });
    for (const f of [DB_FILE, `${DB_FILE}-wal`, `${DB_FILE}-journal`, ENCRYPTING_FILE]) expect(fs.existsSync(path.join(dir, f)), f).toBe(false);
    const db = await a.open();
    expect((await db.execute("SELECT COUNT(*) AS n FROM sqlite_schema WHERE name = 't'")).rows[0]?.n).toBe(0);
  });
});
