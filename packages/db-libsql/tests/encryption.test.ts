// Encryption through libsql's built-in cipher, on real files in a temp folder. The first test is the cipher detector:
// it fails if a libsql build ever ships without encryption (CI runs it on every OS of the release).
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openLibsql, type LibsqlDb } from '../src/index.ts';

const KEY = 'c0ffee'.padEnd(64, '0');
const OTHER_KEY = 'beef'.padEnd(64, '1');
const CANARY = 'CANARY-Вигаданий-Мерчант-7731';

let dir: string;
let file: string;
const open: LibsqlDb[] = [];
const openDb = async (key?: string) => {
  const db = await openLibsql(`file:${file}`, key === undefined ? {} : { encryptionKey: key });
  open.push(db);
  return db;
};
const sha = (p: string) => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const contains = (p: string, text: string) => fs.existsSync(p) && fs.readFileSync(p).includes(Buffer.from(text));

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dbenc-'));
  file = path.join(dir, 'test.db');
});
afterEach((ctx) => {
  for (const db of open.splice(0)) db.close();
  try {
    // Windows may release a closed database file a moment later: rmSync retries on EBUSY.
    fs.rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  } catch (e) {
    // Which of the files is still held (tests/windows-file-release.test.ts explains why); the failure stays a failure.
    const files = fs.existsSync(dir) ? fs.readdirSync(dir) : [];
    const held = files.map((f) => {
      try {
        fs.renameSync(path.join(dir, f), path.join(dir, `${f}.probe`));
        fs.renameSync(path.join(dir, `${f}.probe`), path.join(dir, f));
        return { file: f, movable: true };
      } catch (err) {
        return { file: f, movable: false, code: (err as NodeJS.ErrnoException).code ?? null };
      }
    });
    process.stdout.write(`DIAG ${JSON.stringify({ test: ctx.task.name, cleanup: (e as NodeJS.ErrnoException).code ?? null, held })}\n`);
    throw e;
  }
});

async function seed(key?: string) {
  const db = await openDb(key);
  await db.execute('CREATE TABLE t (id INTEGER PRIMARY KEY AUTOINCREMENT, text TEXT)');
  await db.execute({ sql: 'INSERT INTO t (text) VALUES (?)', args: [CANARY] });
  return db;
}

describe('libsql encryption', () => {
  it('cipher detector: SQLite3 Multiple Ciphers with aes256cbc is in this build', async () => {
    const db = await openDb(KEY);
    const v = await db.execute('SELECT sqlite3mc_version() AS v');
    expect(String(v.rows[0]?.v)).toMatch(/^SQLite3 Multiple Ciphers/);
    const c = await db.execute('PRAGMA cipher');
    expect(Object.values(c.rows[0] ?? {})).toContain('aes256cbc');
  });

  it('with a key: the header is not «SQLite format 3», the canary is in neither the file nor the WAL', async () => {
    const db = await seed(KEY);
    expect(fs.readFileSync(file).subarray(0, 16).toString('latin1')).not.toBe('SQLite format 3\0');
    expect(contains(file, CANARY)).toBe(false);
    expect(contains(`${file}-wal`, CANARY)).toBe(false);
    db.close();
    open.splice(open.indexOf(db), 1);
    const again = await openDb(KEY);
    expect((await again.execute('SELECT text FROM t')).rows[0]?.text).toBe(CANARY);
  });

  it('wrong key and no key → SQLITE_NOTADB; an empty key is refused before opening', async () => {
    (await seed(KEY)).close();
    open.length = 0;
    // openLibsql itself fails: its first PRAGMA already reads the file.
    await expect(openLibsql(`file:${file}`, { encryptionKey: OTHER_KEY })).rejects.toThrow(/NOTADB|not a database/i);
    await expect(openLibsql(`file:${file}`)).rejects.toThrow(/NOTADB|not a database/i);
    await expect(openLibsql(`file:${file}`, { encryptionKey: '' })).rejects.toThrow('empty encryption key');
  });

  it('a key for a plain file → SQLITE_NOTADB, and the file is left unchanged', async () => {
    const plain = await seed();
    plain.close();
    open.length = 0;
    const before = sha(file);
    await expect(openLibsql(`file:${file}`, { encryptionKey: KEY })).rejects.toThrow(/NOTADB|not a database/i);
    expect(sha(file)).toBe(before);
    expect((await (await openDb()).execute('SELECT text FROM t')).rows[0]?.text).toBe(CANARY);
  });

  it('two connections with one key (main + import worker) write in turn', async () => {
    const a = await seed(KEY);
    const b = await openDb(KEY);
    for (let i = 0; i < 20; i++) {
      await (i % 2 ? a : b).execute({ sql: 'INSERT INTO t (text) VALUES (?)', args: [`row ${i}`] });
    }
    expect((await a.execute('SELECT COUNT(*) AS n FROM t')).rows[0]?.n).toBe(21);
    expect((await b.execute('PRAGMA integrity_check')).rows[0]?.integrity_check).toBe('ok');
  });

  it('without a key everything is as before: a plain SQLite file', async () => {
    await seed();
    expect(fs.readFileSync(file).subarray(0, 16).toString('latin1')).toBe('SQLite format 3\0');
  });
});
