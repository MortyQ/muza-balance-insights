// Node adapter: libsql → the Db contract of @mono/core (packages/core/src/db.ts).
// The types are repeated here on purpose, so this package does not depend on core (no workspace cycle:
// core uses this adapter as a devDependency for its tests). Core's typecheck assigns openLibsql() to its Db,
// so any drift between the two fails there.
import fs from 'node:fs';
import path from 'node:path';
import { createClient, type InStatement } from '@libsql/client';

export type SqlValue = null | string | number | bigint | ArrayBuffer | Uint8Array;
export type SqlArg = SqlValue | boolean;
export type Stmt = string | { sql: string; args?: readonly SqlArg[] };
export type Row = Record<string, SqlValue>;
export type ResultSet = { rows: Row[]; rowsAffected: number };

export type LibsqlDb = {
  execute(stmt: Stmt): Promise<ResultSet>;
  batch(stmts: readonly Stmt[]): Promise<void>;
  close(): void;
};

/**
 * Opens a libsql database. No migrations here — the caller runs core's migrate().
 * `url` is `file:/abs/path.db` or `:memory:` (tests).
 */
export async function openLibsql(url: string): Promise<LibsqlDb> {
  const isFile = url.startsWith('file:');
  if (isFile) {
    fs.mkdirSync(path.dirname(url.slice('file:'.length)), { recursive: true });
  }
  const client = createClient({
    url,
    // One connection per process: per-connection PRAGMAs (foreign_keys) stay in effect,
    // and there is no intra-process write contention. Cross-process (CLI + MCP) is handled by WAL + busy timeout.
    concurrency: 1,
    timeout: 5_000,
  });
  if (isFile) {
    await client.execute('PRAGMA journal_mode = WAL');
  }
  await client.execute('PRAGMA foreign_keys = ON');

  return {
    async execute(stmt) {
      const rs = await client.execute(stmt as InStatement);
      return { rows: rs.rows as unknown as Row[], rowsAffected: rs.rowsAffected };
    },
    async batch(stmts) {
      // 'write' mode: one transaction, all or nothing.
      await client.batch(stmts as InStatement[], 'write');
    },
    close: () => client.close(),
  };
}
