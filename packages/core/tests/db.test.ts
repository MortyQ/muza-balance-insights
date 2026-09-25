import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { migrate, SCHEMA_VERSION, type Db } from '../src/db.ts';
import { openTestDb as openDb } from './helpers.ts';

let db: Db | undefined;
let tmpDir: string | undefined;

afterEach(() => {
  db?.close();
  db = undefined;
  if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
  tmpDir = undefined;
});

async function tableNames(d: Db): Promise<string[]> {
  const rs = await d.execute("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name");
  return rs.rows.map((r) => String(r.name));
}

describe('db migrations', () => {
  it('creates all tables', async () => {
    db = await openDb(':memory:');
    expect(await tableNames(db)).toEqual(
      expect.arrayContaining([
        'accounts',
        'api_calls',
        'category_overrides',
        'schema_migrations',
        'sync_state',
        'transactions',
      ]),
    );
    const v = await db.execute('SELECT MAX(version) AS v FROM schema_migrations');
    expect(Number(v.rows[0]?.v)).toBe(SCHEMA_VERSION);
  });

  it('is idempotent: re-running applies nothing and keeps data', async () => {
    db = await openDb(':memory:');
    await db.execute({
      sql: `INSERT INTO accounts (id, kind, currency_code, balance, updated_at) VALUES (?, 'card', 980, 100, 0)`,
      args: ['acc1'],
    });
    expect(await migrate(db, 0)).toEqual([]);
    expect(await migrate(db, 0)).toEqual([]);
    const rs = await db.execute('SELECT COUNT(*) AS n FROM accounts');
    expect(Number(rs.rows[0]?.n)).toBe(1);
  });

  it('records the injected time as applied_at (the core never reads the clock)', async () => {
    const { openLibsql } = await import('@mono/db-libsql');
    db = await openLibsql(':memory:');
    expect(await migrate(db, 1_234_567)).toHaveLength(SCHEMA_VERSION);
    const rs = await db.execute('SELECT DISTINCT applied_at FROM schema_migrations');
    expect(rs.rows.map((r) => Number(r.applied_at))).toEqual([1_234_567]);
  });

  it('reopening a file database does not re-apply migrations', async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mono-db-'));
    const url = `file:${path.join(tmpDir, 'nested', 'test.db')}`;
    db = await openDb(url);
    db.close();
    db = await openDb(url);
    const rs = await db.execute('SELECT COUNT(*) AS n FROM schema_migrations');
    expect(Number(rs.rows[0]?.n)).toBe(SCHEMA_VERSION);
    const mode = await db.execute('PRAGMA journal_mode');
    expect(String(Object.values(mode.rows[0] ?? {})[0])).toBe('wal');
  });

  it('enforces foreign keys and CHECK constraints', async () => {
    db = await openDb(':memory:');
    await expect(
      db.execute(
        `INSERT INTO transactions (id, account_id, time, local_date, mcc, hold, amount, currency_code, raw_json, synced_at)
         VALUES ('t1', 'missing', 0, '1970-01-01', 5411, 0, -1, 980, '{}', 0)`,
      ),
    ).rejects.toThrow(/FOREIGN KEY/i);
    await expect(
      db.execute(`INSERT INTO accounts (id, kind, currency_code, balance, updated_at) VALUES ('a', 'bogus', 980, 0, 0)`),
    ).rejects.toThrow(/CHECK/i);
  });
});
