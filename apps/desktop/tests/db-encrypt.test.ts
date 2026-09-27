// The plain → encrypted migration on real libsql files with the current core schema and fictional rows. A failure
// injected at every step leaves the old database as it was (same content — its bytes may differ: opening a WAL
// database and its checkpoint touch the header — and no leftover copy); after a
// successful run the file is encrypted, holds the same schema, rows, AUTOINCREMENT counters and user_version.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { migrate, SCHEMA_VERSION } from '@mono/core/db';
import { insertAccount } from '@mono/core/test-helpers';
import { openLibsql } from '@mono/db-libsql';
import { encryptDatabase, encryptingFiles, MIGRATION_STEPS, type EncryptDeps } from '../src/main/db/encrypt.ts';

const KEY = 'c0ffee'.padEnd(64, '0');
const CANARY = 'CANARY-Вигаданий-Мерчант-7731';

let dir: string;
let file: string;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dbenc-mig-'));
  file = path.join(dir, 'monobank.db');
});
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

/** A migrated core database with rows in AUTOINCREMENT tables, one deleted (sqlite_sequence ahead of MAX(id)). */
async function makePlain() {
  const db = await openLibsql(`file:${file}`);
  await migrate(db, 1_700_000_000);
  await insertAccount(db, 'acc-1');
  await db.execute({ sql: "INSERT INTO category_overrides (pattern, match_type, category) VALUES (?, 'exact', 'кафе')", args: [CANARY] });
  await db.execute("INSERT INTO category_overrides (pattern, match_type, category) VALUES ('Вигадана Кавʼярня', 'contains', 'кафе')");
  await db.execute("DELETE FROM category_overrides WHERE pattern = 'Вигадана Кавʼярня'");
  await db.execute('PRAGMA user_version = 7');
  db.close();
}

async function snapshot(key?: string) {
  const db = await openLibsql(`file:${file}`, key ? { encryptionKey: key } : {});
  try {
    const schema = (await db.execute('SELECT type, name, sql FROM sqlite_schema ORDER BY type, name')).rows;
    const tables = schema.filter((r) => r.type === 'table').map((r) => String(r.name));
    const rows: Record<string, unknown[]> = {};
    for (const t of tables) rows[t] = (await db.execute(`SELECT * FROM "${t}" ORDER BY 1`)).rows;
    const uv = (await db.execute('PRAGMA user_version')).rows[0];
    return { schema, rows, userVersion: Object.values(uv ?? {})[0] };
  } finally {
    db.close();
  }
}

const deps = (extra: Partial<EncryptDeps> = {}): EncryptDeps & { logs: string[] } => {
  const logs: string[] = [];
  return { file, key: KEY, openDb: (u, o) => openLibsql(u, o), platform: process.platform, log: (m) => void logs.push(m), logs, ...extra };
};
const leftovers = () => encryptingFiles(file).filter((f) => fs.existsSync(f));

describe('encryptDatabase', () => {
  it('encrypts in place: same schema, rows, counters and user_version; no canary on disk; no copy left', async () => {
    await makePlain();
    const before = await snapshot();
    expect(before.rows.sqlite_sequence!.length).toBeGreaterThan(0);
    const d = deps();
    expect(await encryptDatabase(d)).toEqual({ ok: true });
    expect(fs.readFileSync(file).subarray(0, 15).toString('latin1')).not.toBe('SQLite format 3');
    for (const f of fs.readdirSync(dir)) expect(fs.readFileSync(path.join(dir, f)).includes(Buffer.from(CANARY))).toBe(false);
    expect(await snapshot(KEY)).toEqual(before);
    expect(leftovers()).toEqual([]);
    const db = await openLibsql(`file:${file}`, { encryptionKey: KEY });
    expect(Number((await db.execute('SELECT MAX(version) AS v FROM schema_migrations')).rows[0]?.v)).toBe(SCHEMA_VERSION);
    db.close();
    expect(JSON.stringify(d.logs)).not.toContain(KEY);
  });

  it.each(MIGRATION_STEPS.filter((s) => s !== 'cleanup'))('a failure at «%s» leaves the old database as it was', async (step) => {
    await makePlain();
    const before = await snapshot();
    const d = deps({ fault: (s) => {
      if (s === step) throw new Error(`injected ${KEY}`);
    } });
    expect(await encryptDatabase(d)).toEqual({ ok: false, step });
    expect(fs.readFileSync(file).subarray(0, 15).toString('latin1')).toBe('SQLite format 3');
    expect(await snapshot()).toEqual(before);
    expect(leftovers()).toEqual([]);
    expect(d.logs).toEqual([`encrypt step=${step}: Error`]);
    // …and the next launch finishes it.
    expect(await encryptDatabase(deps())).toEqual({ ok: true });
    expect(await snapshot(KEY)).toEqual(before);
  });

  it('a failure at «cleanup» (after the swap) is only logged: the database is already encrypted', async () => {
    await makePlain();
    const d = deps({ fault: (s) => {
      if (s === 'cleanup') throw new Error('injected');
    } });
    expect(await encryptDatabase(d)).toEqual({ ok: true });
    expect(d.logs).toEqual(['encrypt cleanup: Error']);
    expect((await snapshot(KEY)).rows.accounts!.length).toBe(1);
  });

  it('a crash left a half copy: the next run starts over and succeeds', async () => {
    await makePlain();
    fs.writeFileSync(`${file}.encrypting`, 'half a copy');
    fs.writeFileSync(`${file}.encrypting-journal`, 'x');
    expect(await encryptDatabase(deps())).toEqual({ ok: true });
    expect(leftovers()).toEqual([]);
  });

  it('Windows: a rename held by another process is retried; a lasting error gives up with the old file intact', async () => {
    await makePlain();
    let tries = 0;
    const busy = (times: number) => async (a: string, b: string) => {
      if (tries++ < times) throw Object.assign(new Error('busy'), { code: 'EBUSY' });
      await fs.promises.rename(a, b);
    };
    const sleep = async () => undefined;
    expect(await encryptDatabase(deps({ rename: busy(2), sleep }))).toEqual({ ok: true });
    expect(tries).toBe(3);

    fs.rmSync(file);
    await makePlain();
    tries = 0;
    expect(await encryptDatabase(deps({ rename: busy(99), sleep }))).toEqual({ ok: false, step: 'swap' });
    expect(tries).toBe(5);
    expect(fs.readFileSync(file).subarray(0, 15).toString('latin1')).toBe('SQLite format 3');
    expect(leftovers()).toEqual([]);
  });
});
