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

export type OpenOptions = {
  /**
   * The whole file (and its WAL) encrypted: libsql's SQLite3 Multiple Ciphers, AES-256-CBC, no HMAC — hides the content,
   * does not detect tampering. The key as is (the desktop passes 64 hex characters), never `x'…'`. A wrong or missing
   * key fails on the first statement with SQLITE_NOTADB; so does a key for a plain file (the file is left unchanged).
   */
  encryptionKey?: string;
};

/**
 * Opens a libsql database. No migrations here — the caller runs core's migrate().
 * `url` is `file:/abs/path.db` or `:memory:` (tests).
 */
export async function openLibsql(url: string, opts: OpenOptions = {}): Promise<LibsqlDb> {
  if (opts.encryptionKey === '') throw new Error('empty encryption key');
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
    ...(opts.encryptionKey ? { encryptionKey: opts.encryptionKey } : {}),
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
