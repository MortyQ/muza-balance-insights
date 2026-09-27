// A plain database → the same database encrypted, in place, crash-safe. Runs at launch from DbAccess, while no other
// connection exists (before DataService, the import worker and the dev smoke; one app instance).
// The new file is opened with the key and the old one attached unencrypted (`KEY ''`), so every CREATE is copied as
// SQLite stored it — no rewriting of names. Until the rename the old database is never written: any failure removes
// the copy and leaves the old file as it was (it is opened plain and the migration is retried at the next launch).
import fs from 'node:fs';
import path from 'node:path';
import type { Db } from '@mono/core/db';
import { syncDir } from './key-vault.ts';

export const MIGRATION_STEPS = ['checkpoint', 'attach', 'copy', 'verify', 'sync', 'swap', 'cleanup'] as const;
export type MigrationStep = (typeof MIGRATION_STEPS)[number];
export type MigrationResult = { ok: true } | { ok: false; step: MigrationStep };

export type EncryptDeps = {
  /** The database file (monobank.db); the copy is `<file>.encrypting`. */
  file: string;
  key: string;
  openDb: (url: string, opts?: { encryptionKey?: string }) => Promise<Db>;
  platform: NodeJS.Platform;
  rename?: (from: string, to: string) => Promise<void>;
  /** Tests: throws at the start of the given step. */
  fault?: (step: MigrationStep) => void;
  /** Step names and error names only — never an error message (it may quote SQL). */
  log: (msg: string) => void;
  sleep?: (ms: number) => Promise<void>;
};

/** Every file the copy can leave behind. */
export const encryptingFiles = (file: string) => ['', '-journal', '-wal', '-shm'].map((s) => `${file}.encrypting${s}`);

type SchemaRow = { type: string; name: string; tbl_name: string; sql: string | null };
type Reference = {
  schema: SchemaRow[];
  counts: Record<string, number>;
  sequence: Array<{ name: string; seq: number }>;
  userVersion: number;
};

const ORDER = ['table', 'index', 'view', 'trigger'];
const q = (name: string) => `"${name.replaceAll('"', '""')}"`;

async function readReference(db: Db, schemaName: string): Promise<Reference> {
  const s = q(schemaName);
  const schema = (await db.execute(`SELECT type, name, tbl_name, sql FROM ${s}.sqlite_schema ORDER BY type, name`)).rows as unknown as SchemaRow[];
  const counts: Record<string, number> = {};
  for (const t of schema.filter((r) => r.type === 'table')) {
    counts[t.name] = Number((await db.execute(`SELECT COUNT(*) AS n FROM ${s}.${q(t.name)}`)).rows[0]?.n);
  }
  const sequence = schema.some((r) => r.name === 'sqlite_sequence')
    ? ((await db.execute(`SELECT name, seq FROM ${s}.sqlite_sequence ORDER BY name`)).rows as unknown as Reference['sequence']).map((r) => ({
        name: String(r.name),
        seq: Number(r.seq),
      }))
    : [];
  const userVersion = Number(Object.values((await db.execute(`PRAGMA ${s}.user_version`)).rows[0] ?? {})[0]);
  return { schema: schema.map((r) => ({ type: r.type, name: r.name, tbl_name: r.tbl_name, sql: r.sql })), counts, sequence, userVersion };
}

export async function encryptDatabase(d: EncryptDeps): Promise<MigrationResult> {
  const tmp = `${d.file}.encrypting`;
  const rename = d.rename ?? ((a: string, b: string) => fs.promises.rename(a, b));
  const sleep = d.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  let step: MigrationStep = 'checkpoint';
  const enter = (s: MigrationStep) => {
    step = s;
    d.fault?.(s);
  };
  const removeCopy = async () => {
    for (const f of encryptingFiles(d.file)) await fs.promises.rm(f, { force: true });
  };
  let conn: Db | null = null;
  const closeConn = () => {
    conn?.close();
    conn = null;
  };

  try {
    enter('checkpoint');
    await removeCopy();
    conn = await d.openDb(`file:${d.file}`);
    const cp = (await conn.execute('PRAGMA wal_checkpoint(TRUNCATE)')).rows[0];
    if (Number(cp?.busy ?? 0) !== 0) throw new Error('checkpoint busy');
    const reference = await readReference(conn, 'main');
    closeConn();

    enter('attach');
    conn = await d.openDb(`file:${tmp}`, { encryptionKey: d.key });
    await conn.execute('PRAGMA journal_mode = DELETE');
    await conn.execute('PRAGMA foreign_keys = OFF');
    await conn.execute({ sql: "ATTACH DATABASE ? AS old KEY ''", args: [d.file] });

    enter('copy');
    const objects = reference.schema
      .filter((r) => r.sql !== null && r.name !== 'sqlite_sequence')
      .sort((a, b) => ORDER.indexOf(a.type) - ORDER.indexOf(b.type));
    const tables = objects.filter((r) => r.type === 'table');
    await conn.batch([
      ...objects.map((r) => r.sql as string),
      ...tables.map((t) => `INSERT INTO main.${q(t.name)} SELECT * FROM old.${q(t.name)}`),
      ...(reference.sequence.length > 0 ? ['DELETE FROM main.sqlite_sequence', 'INSERT INTO main.sqlite_sequence SELECT * FROM old.sqlite_sequence'] : []),
    ]);
    await conn.execute(`PRAGMA main.user_version = ${reference.userVersion}`);
    await conn.execute('DETACH DATABASE old');
    closeConn();
    const oldWal = `${d.file}-wal`;
    if (fs.existsSync(oldWal) && fs.statSync(oldWal).size > 0) throw new Error('old WAL not empty');

    enter('verify');
    conn = await d.openDb(`file:${tmp}`, { encryptionKey: d.key });
    const integrity = (await conn.execute('PRAGMA integrity_check')).rows[0];
    if (Object.values(integrity ?? {})[0] !== 'ok') throw new Error('integrity');
    if ((await conn.execute('PRAGMA foreign_key_check')).rows.length > 0) throw new Error('foreign keys');
    const copy = await readReference(conn, 'main');
    closeConn();
    if (JSON.stringify(copy) !== JSON.stringify(reference)) throw new Error('copy differs');

    enter('sync');
    const handle = await fs.promises.open(tmp, 'r+');
    try {
      await handle.sync();
    } finally {
      await handle.close();
    }

    enter('swap');
    await fs.promises.rm(`${d.file}-shm`, { force: true });
    await fs.promises.rm(oldWal, { force: true });
    // Windows: an antivirus or the indexer may hold the file for a moment.
    for (let attempt = 0; ; attempt++) {
      try {
        await rename(tmp, d.file);
        break;
      } catch (err) {
        const code = (err as NodeJS.ErrnoException).code;
        if (attempt >= 4 || (code !== 'EPERM' && code !== 'EBUSY')) throw err;
        await sleep(100 * (attempt + 1));
      }
    }
  } catch (err) {
    try {
      closeConn();
    } catch {
      // the error that matters is the one above
    }
    await removeCopy().catch(() => undefined);
    d.log(`encrypt step=${step}: ${err instanceof Error ? err.name : 'error'}`);
    return { ok: false, step };
  }

  // The encrypted database is in place: what follows cannot undo that.
  try {
    enter('cleanup');
    await syncDir(path.dirname(d.file), d.platform);
    await removeCopy();
  } catch (err) {
    d.log(`encrypt cleanup: ${err instanceof Error ? err.name : 'error'}`);
  }
  return { ok: true };
}
