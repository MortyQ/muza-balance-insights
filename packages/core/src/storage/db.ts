// Platform-neutral database contract. Adapters (Node: @mono/db-libsql) implement Db;
// the core only knows this interface and the migrations (migrations.ts).
import { MIGRATIONS } from './migrations.ts';

export type SqlValue = null | string | number | bigint | ArrayBuffer | Uint8Array;
export type SqlArg = SqlValue | boolean;
export type Stmt = string | { sql: string; args?: readonly SqlArg[] };
export type Row = Record<string, SqlValue>;
export type ResultSet = { rows: Row[]; rowsAffected: number };

export interface Db {
  execute(stmt: Stmt): Promise<ResultSet>;
  /** One transaction: every statement applies, or none does. */
  batch(stmts: readonly Stmt[]): Promise<void>;
  close(): void;
}

/**
 * Migrations are append-only: never edit an applied entry, add a new one.
 * Each entry runs once, atomically, and is recorded in schema_migrations.
 */
export type Migration = {
  version: number;
  name: string;
  statements: string[];
  /** Rewrites most of the file: `migrate()` compacts it afterwards (VACUUM, best-effort). */
  compact?: true;
};

/** What happened to a compaction `migrate()` ran after a migration flagged `compact`. */
export type CompactionResult = { ok: true } | { ok: false; error: unknown };

/**
 * Applies pending migrations; `nowSec` is recorded as applied_at (the core never reads the clock itself). After a
 * migration flagged `compact` it compacts the file once, outside the migration's transaction. Compaction is
 * best-effort: a failure (another connection busy) leaves the migration applied, is passed to `onCompaction`, and is
 * not retried.
 */
export async function migrate(
  db: Db,
  nowSec: number,
  onCompaction?: (result: CompactionResult) => void,
): Promise<number[]> {
  await db.execute(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
      version    INTEGER PRIMARY KEY,
      name       TEXT NOT NULL,
      applied_at INTEGER NOT NULL
    )`,
  );
  const applied = new Set(
    (await db.execute('SELECT version FROM schema_migrations')).rows.map((r) => Number(r.version)),
  );
  const newlyApplied: number[] = [];
  let compact = false;
  for (const m of MIGRATIONS) {
    if (applied.has(m.version)) continue;
    // batch() is a single transaction: a migration applies fully or not at all.
    await db.batch(
      [
        ...m.statements.map((sql) => ({ sql, args: [] })),
        {
          sql: 'INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)',
          args: [m.version, m.name, nowSec],
        },
      ],
    );
    newlyApplied.push(m.version);
    if (m.compact) compact = true;
  }
  if (compact) onCompaction?.(await compactDb(db));
  return newlyApplied;
}

/** VACUUM, then a WAL checkpoint so the main file really shrinks. Never throws. */
async function compactDb(db: Db): Promise<CompactionResult> {
  try {
    await db.execute('VACUUM');
    await db.execute('PRAGMA wal_checkpoint(TRUNCATE)');
    return { ok: true };
  } catch (error) {
    return { ok: false, error };
  }
}
