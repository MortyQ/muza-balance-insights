// Stage 1, step 2: proves the Node adapter (libsql, Node-API) loads and works in the Electron main process.
// Prints versions and aggregates only — no data (the database is new and empty).
import path from 'node:path';
import { migrate, SCHEMA_VERSION, type Db } from '@mono/core/db';
import { openLibsql } from '@mono/db-libsql';
import { DB_FILE } from './wipe.ts';

export type SmokeResult =
  | { ok: true; memory: number; fileSchema: number; expectedSchema: number; sqlite: string; dbFile: string }
  | { ok: false; error: string };

export async function runDbSmoke(userDataDir: string, nowSec: number): Promise<SmokeResult> {
  try {
    const mem: Db = await openLibsql(':memory:');
    const n = Number((await mem.execute('SELECT 41 + 1 AS n')).rows[0]?.n);
    const sqlite = String((await mem.execute('SELECT sqlite_version() AS v')).rows[0]?.v);
    mem.close();

    const dbFile = path.join(userDataDir, DB_FILE);
    const db: Db = await openLibsql(`file:${dbFile}`);
    try {
      await migrate(db, nowSec);
      const v = Number((await db.execute('SELECT MAX(version) AS v FROM schema_migrations')).rows[0]?.v);
      return { ok: true, memory: n, fileSchema: v, expectedSchema: SCHEMA_VERSION, sqlite, dbFile: path.basename(dbFile) };
    } finally {
      db.close();
    }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? `${err.name}: ${err.message}` : 'unknown error' };
  }
}
