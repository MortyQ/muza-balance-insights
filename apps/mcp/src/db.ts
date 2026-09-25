// Node entry to the database: libsql adapter + core migrations.
import { migrate, type Db } from '@mono/core/db';
import { openLibsql } from '@mono/db-libsql';

export type { Db } from '@mono/core/db';

/** Opens the database and applies pending migrations. `url`: `file:/abs/path.db` or `:memory:` (tests). */
export async function openDb(url: string): Promise<Db> {
  const db: Db = await openLibsql(url);
  await migrate(db, Math.floor(Date.now() / 1000));
  return db;
}
