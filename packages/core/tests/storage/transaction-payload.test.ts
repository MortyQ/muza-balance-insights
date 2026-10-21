// Migration v16 (the bank's payload in transaction_raw, transactions rebuilt hot columns first, nullable mcc,
// crossing_category, derived_state) and the one-time compaction after it. Fictional data only.
import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openLibsql } from '@mono/db-libsql';
import { MIGRATIONS, migrate, type CompactionResult, type Db, type Stmt } from '../../src/storage/db.ts';

const open: Db[] = [];
const dirs: string[] = [];
afterEach(() => {
  for (const d of open.splice(0)) d.close();
  for (const d of dirs.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});

const rows = async (d: Db, sql: string) => (await d.execute(sql)).rows;
const indexes = async (d: Db) =>
  (await rows(d, "SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'transactions' AND name LIKE 'idx_%' ORDER BY name")).map(
    (r) => String(r.name),
  );

/** A database at schema v15, built by the real migrations, with `n` fictional operations of `payloadBytes` each. */
async function v15(url: string, n: number, payloadBytes: number): Promise<Db> {
  const d = await openLibsql(url);
  open.push(d);
  const old = MIGRATIONS.filter((x) => x.version <= 15);
  for (const m of old) await d.batch(m.statements.map((sql) => ({ sql, args: [] })));
  await d.execute(`CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at INTEGER NOT NULL)`);
  for (const m of old) await d.execute({ sql: 'INSERT INTO schema_migrations VALUES (?, ?, 0)', args: [m.version, m.name] });
  await d.batch([
    `INSERT INTO participants (id, label, sort, created_at) VALUES (1, 'Fictional', 0, 1)`,
    `INSERT INTO connections (id, participant_id, provider, created_at) VALUES (1, 1, 'monobank', 1)`,
    `INSERT INTO accounts (id, connection_id, kind, type, currency_code, iban, balance, credit_limit, updated_at)
      VALUES ('black', 1, 'card', 'black', 980, 'UA00FICTIONAL0000000000001', 1000, 0, 1)`,
    `INSERT INTO accounts (id, connection_id, kind, currency_code, title, balance, updated_at) VALUES ('jar', 1, 'jar', 980, 'Fictional jar', 50, 1)`,
  ]);
  const stmts: Stmt[] = [];
  for (let i = 0; i < n; i++) {
    const pair = i % 10 === 1;
    stmts.push({
      sql: `INSERT INTO transactions (id, account_id, time, local_date, description, mcc, original_mcc, hold, amount, operation_amount,
              currency_code, commission_rate, cashback_amount, balance, comment, counter_name, counter_iban, counter_edrpou,
              receipt_id, category, is_internal_transfer, raw_json, synced_at, is_cancelled, transfer_pair_id, transfer_rule,
              refund_pair_id, scope)
            VALUES (?, ?, ?, '2026-03-01', ?, ?, ?, ?, ?, ?, 980, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 7, ?, ?, ?, ?, ?)`,
      args: [
        `t${i}`, i % 7 === 0 ? 'jar' : 'black', 1_000 + i, `Fictional shop ${i}`, pair ? 4829 : 5411, i % 3 === 0 ? 5411 : null,
        i % 11 === 0 ? 1 : 0, -100 - i, i % 5 === 0 ? null : -100 - i, i % 4 === 0 ? 5 : null, i % 6 === 0 ? 1 : null, 9_000 - i,
        i % 8 === 0 ? 'fictional comment' : null, i % 9 === 0 ? 'Fictional Person' : null, i % 9 === 0 ? 'UA00FICTIONAL0000000000002' : null,
        i % 13 === 0 ? '00000000' : null, i % 12 === 0 ? `r${i}` : null, pair ? 'свои переводы' : 'продукты', pair ? 1 : 0,
        JSON.stringify({ id: `t${i}`, pad: 'x'.repeat(payloadBytes) }), i % 17 === 0 ? 1 : 0, pair ? `t${i + 1}` : null,
        pair ? 'pair' : null, i % 19 === 0 ? `t${i + 2}` : null, i % 14 === 0 ? 'business' : 'personal',
      ],
    });
  }
  for (let i = 0; i < stmts.length; i += 500) await d.batch(stmts.slice(i, i + 500));
  return d;
}

describe('migration v16', () => {
  it('moves the payload out, keeps every row and value, and keeps the database consistent', async () => {
    const db = await v15(':memory:', 60, 200);
    const before = await rows(db, 'SELECT * FROM transactions ORDER BY id');

    expect(await migrate(db, 0)).toEqual([16]);

    expect(await rows(db, 'SELECT * FROM transactions ORDER BY id')).toEqual(
      before.map(({ raw_json: _raw, ...t }) => ({ ...t, crossing_category: null })),
    );
    expect(await rows(db, 'SELECT id, raw_json FROM transaction_raw ORDER BY id')).toEqual(before.map((t) => ({ id: t.id, raw_json: t.raw_json })));
    expect(await rows(db, 'PRAGMA foreign_key_check')).toEqual([]);
    expect(await rows(db, 'PRAGMA integrity_check')).toEqual([{ integrity_check: 'ok' }]);
    expect(await rows(db, "SELECT name FROM sqlite_master WHERE name = 'transactions_old'")).toEqual([]);
    expect(await indexes(db)).toEqual(['idx_tx_account_time', 'idx_tx_refund_pair', 'idx_tx_time', 'idx_tx_transfer_pair']);
    expect(await rows(db, 'SELECT key, value FROM derived_state')).toEqual([]);
  });

  it('hot columns come first and the payload is not a column of transactions', async () => {
    const db = await v15(':memory:', 0, 0);
    await migrate(db, 0);
    const cols = (await rows(db, 'PRAGMA table_info(transactions)')).map((r) => String(r.name));
    expect(cols.slice(0, 4)).toEqual(['id', 'account_id', 'time', 'amount']);
    expect(cols).toContain('crossing_category');
    expect(cols).not.toContain('raw_json');
  });

  it('accepts an operation without an MCC; the payload follows its operation on delete; checks still hold', async () => {
    const db = await v15(':memory:', 3, 10);
    await migrate(db, 0);
    await db.batch([
      `INSERT INTO transactions (id, account_id, time, local_date, mcc, hold, amount, currency_code, synced_at)
        VALUES ('no-mcc', 'black', 5000, '2026-03-02', NULL, 0, -1, 980, 0)`,
      `INSERT INTO transaction_raw (id, raw_json) VALUES ('no-mcc', '{}')`,
    ]);
    expect(await rows(db, "SELECT mcc FROM transactions WHERE id = 'no-mcc'")).toEqual([{ mcc: null }]);

    await db.execute(`DELETE FROM transactions WHERE account_id = 'black'`);
    expect(await rows(db, 'SELECT t.id FROM transaction_raw t ORDER BY id')).toEqual(
      await rows(db, 'SELECT id FROM transactions ORDER BY id'),
    );
    await expect(db.execute(`INSERT INTO transaction_raw (id, raw_json) VALUES ('nobody', '{}')`)).rejects.toThrow(/FOREIGN KEY/i);
    await expect(db.execute(`UPDATE transactions SET transfer_rule = 'bogus'`)).rejects.toThrow(/CHECK/i);
  });
});

describe('compaction after migration v16', () => {
  /** Two identical v15 files of `n` operations; returns their paths (closed, so the WAL is folded in). */
  async function twoFiles(n: number): Promise<[string, string]> {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mono-compact-'));
    dirs.push(dir);
    const files: [string, string] = [path.join(dir, 'a.db'), path.join(dir, 'b.db')];
    for (const f of files) {
      const d = await v15(`file:${f}`, n, 1000);
      d.close();
      open.splice(open.indexOf(d), 1);
    }
    return files;
  }

  /** A Db whose VACUUM fails, as when another connection holds the file. */
  const vacuumFails = (d: Db): Db => ({
    execute: (stmt) => (stmt === 'VACUUM' ? Promise.reject(new Error('database is locked')) : d.execute(stmt)),
    batch: (stmts) => d.batch(stmts),
    close: () => d.close(),
  });

  it('compacts once: the file ends smaller than an uncompacted migration; a failure is reported and the migration stays', async () => {
    const [compacted, failed] = await twoFiles(1500);

    const ok: CompactionResult[] = [];
    const a = await openLibsql(`file:${compacted}`);
    open.push(a);
    expect(await migrate(a, 0, (r) => ok.push(r))).toEqual([16]);
    expect(ok).toEqual([{ ok: true }]);
    expect(await rows(a, 'PRAGMA freelist_count')).toEqual([{ freelist_count: 0 }]);
    a.close();
    open.splice(open.indexOf(a), 1);

    const bad: CompactionResult[] = [];
    const b = await openLibsql(`file:${failed}`);
    open.push(b);
    expect(await migrate(vacuumFails(b), 0, (r) => bad.push(r))).toEqual([16]);
    expect(bad).toHaveLength(1);
    expect(bad[0]?.ok).toBe(false);
    expect(await rows(b, 'SELECT MAX(version) AS v FROM schema_migrations')).toEqual([{ v: 16 }]);
    expect(await rows(b, 'SELECT COUNT(*) AS n FROM transaction_raw')).toEqual([{ n: 1500 }]);
    // Not retried on the next launch.
    const again: CompactionResult[] = [];
    expect(await migrate(b, 0, (r) => again.push(r))).toEqual([]);
    expect(again).toEqual([]);
    b.close();
    open.splice(open.indexOf(b), 1);

    expect(fs.statSync(compacted).size).toBeLessThan(fs.statSync(failed).size);
  });
});
