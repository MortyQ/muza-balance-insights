// Migration v17: the bank's own category and the implicit transfer fee, as added columns. Fictional data only.
import { afterEach, describe, expect, it } from 'vitest';
import { openLibsql } from '@mono/db-libsql';
import { migrate, type Db } from '../../src/storage/db.ts';
import { MIGRATIONS } from '../../src/storage/migrations.ts';

const open: Db[] = [];
afterEach(() => {
  for (const d of open.splice(0)) d.close();
});

/** A database at schema v16, built by the real migrations, with one fictional operation. */
async function v16(): Promise<Db> {
  const d = await openLibsql(':memory:');
  open.push(d);
  const old = MIGRATIONS.filter((x) => x.version <= 16);
  for (const m of old) await d.batch(m.statements.map((sql) => ({ sql, args: [] })));
  await d.execute(`CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at INTEGER NOT NULL)`);
  for (const m of old) await d.execute({ sql: 'INSERT INTO schema_migrations VALUES (?, ?, 0)', args: [m.version, m.name] });
  await d.batch([
    `INSERT INTO participants (id, label, sort, created_at) VALUES (1, 'Fictional', 0, 1)`,
    `INSERT INTO connections (id, participant_id, provider, created_at) VALUES (1, 1, 'monobank', 1)`,
    `INSERT INTO accounts (id, connection_id, kind, type, currency_code, balance, updated_at) VALUES ('black', 1, 'card', 'black', 980, 100, 1)`,
    `INSERT INTO transactions (id, account_id, time, amount, hold, category, mcc, currency_code, description, local_date, synced_at)
      VALUES ('t1', 'black', 1000, -500, 0, 'продукты', 5411, 980, 'Fictional shop', '2026-03-01', 7)`,
  ]);
  return d;
}

describe('migration v17', () => {
  it('adds both columns as NULL and keeps every row as it was', async () => {
    const d = await v16();
    const before = (await d.execute('SELECT * FROM transactions')).rows;
    expect(await migrate(d, 2)).toEqual([17]);
    const after = (await d.execute('SELECT * FROM transactions')).rows;
    expect(after).toHaveLength(1);
    expect(after[0]).toEqual({ ...before[0], bank_category: null, transfer_fee: null });
  });

  it('the columns take a bank category and a fee', async () => {
    const d = await v16();
    await migrate(d, 2);
    await d.execute(`UPDATE transactions SET bank_category = 'Fictional category', transfer_fee = 12 WHERE id = 't1'`);
    expect((await d.execute('SELECT bank_category, transfer_fee FROM transactions')).rows[0]).toEqual({ bank_category: 'Fictional category', transfer_fee: 12 });
  });
});
