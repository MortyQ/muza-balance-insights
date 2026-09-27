// Node adapter: libsql → the Db contract of @mono/core (packages/core/src/db.ts).
// The types are repeated here on purpose, so this package does not depend on core (no workspace cycle:
// core uses this adapter as a devDependency for its tests). Core's typecheck assigns openLibsql() to its Db,
// so any drift between the two fails there.
import fs from 'node:fs';
import path from 'node:path';
import v8 from 'node:v8';
import vm from 'node:vm';
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
  try {
    if (isFile) {
      await client.execute('PRAGMA journal_mode = WAL');
    }
    await client.execute('PRAGMA foreign_keys = ON');
  } catch (err) {
    // A wrong or missing key fails here. Close, or the file stays open — on Windows locked (EBUSY for a later delete).
    client.close();
    throw err;
  }

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

let gc: (() => void) | null | undefined;
function forcedGc(): (() => void) | null {
  if (gc === undefined) {
    try {
      v8.setFlagsFromString('--expose-gc');
      gc = vm.runInNewContext('gc') as () => void;
    } catch {
      gc = null;
    }
  }
  return gc;
}

/** Whether this runtime can force a collection (checked once; Node and Electron's main process expose it on request). */
export function canReleaseClosedFiles(): boolean {
  return forcedGc() !== null;
}

/**
 * Lets the files of closed databases go. A closed connection still holds its files while its prepared statements are
 * alive: libsql-js has no Statement.close, and @libsql/client prepares one per execute — they go only when garbage-collected.
 * On macOS and Linux that is invisible; on Windows the files cannot be renamed or deleted until then (EBUSY), and waiting
 * does not help (measured on the Windows CI runner: held after 1 s, free right after a forced gc). Call it after close()
 * and before renaming or deleting database files. Global: one call covers every database closed before it.
 * false: no forced gc in this runtime — the files are released whenever V8 collects on its own.
 */
export async function releaseClosedFiles(): Promise<boolean> {
  const collect = forcedGc();
  if (!collect) return false;
  collect();
  // Native finalizers run after the collection: give them a turn, then collect again.
  await new Promise((r) => setImmediate(r));
  collect();
  await new Promise((r) => setTimeout(r, 50));
  return true;
}
