// Stage 1, step 2: proves the Node adapter (libsql, Node-API) loads and works in the Electron main process.
// Prints versions and aggregates only — no data. The file is opened the way the app opens it (DbAccess: with its key
// when encrypted), never directly: a direct open would create a plain file before DbAccess decides.
import { migrate, SCHEMA_VERSION, type Db } from '@mono/core/db';
import { openLibsql } from '@mono/db-libsql';

export type SmokeResult =
  | { ok: true; memory: number; fileSchema: number; expectedSchema: number; sqlite: string; encrypted: boolean }
  | { ok: false; error: string };

export async function runDbSmoke(open: () => Promise<Db>, encrypted: boolean, nowSec: number): Promise<SmokeResult> {
  try {
    const mem: Db = await openLibsql(':memory:');
    const n = Number((await mem.execute('SELECT 41 + 1 AS n')).rows[0]?.n);
    const sqlite = String((await mem.execute('SELECT sqlite_version() AS v')).rows[0]?.v);
    mem.close();

    const db = await open();
    try {
      await migrate(db, nowSec);
      const v = Number((await db.execute('SELECT MAX(version) AS v FROM schema_migrations')).rows[0]?.v);
      return { ok: true, memory: n, fileSchema: v, expectedSchema: SCHEMA_VERSION, sqlite, encrypted };
    } finally {
      db.close();
    }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.name : 'unknown error' };
  }
}
