// The tables' own currency CHECK (migration 23) against the app's one list (APP_CURRENCIES): every listed currency is
// stored, any other refused; and the rebuild keeps rows, links, ids and the one-per-owner index.
import { afterEach, describe, expect, it } from 'vitest';
import { openLibsql } from '@mono/db-libsql';
import { APP_CURRENCY_CODES } from '../../src/shared/currency.ts';
import { migrate, type Db } from '../../src/storage/db.ts';
import { MIGRATIONS } from '../../src/storage/migrations.ts';
import { memoryDb } from '../helpers.ts';

const open: Db[] = [];
afterEach(() => {
  for (const d of open.splice(0)) d.close();
});

const reserve = (db: Db, currency: number) =>
  db.execute({ sql: `INSERT INTO reserves (name, currency, amount, until, created_at) VALUES ('x', ?, 1, NULL, 0) RETURNING id`, args: [currency] });
const limit = (db: Db, currency: number, category: string) =>
  db.execute({ sql: `INSERT INTO goals (type, category, period, currency, amount, created_at) VALUES ('limit', ?, 'month', ?, 1, 0) RETURNING id`, args: [category, currency] });

describe('currency CHECK', () => {
  it('stores every currency of the app list and refuses any other', async () => {
    const db = await memoryDb();
    open.push(db);
    for (const c of APP_CURRENCY_CODES) {
      await reserve(db, c);
      await limit(db, c, `кат-${c}`);
    }
    await expect(reserve(db, 826)).rejects.toThrow();
    await expect(limit(db, 826, 'кат-826')).rejects.toThrow();
  });

  it('migration 23 keeps every row, the fixed rows and their cascade, the id counters and the index', async () => {
    const db = await openLibsql(':memory:');
    open.push(db);
    const upTo22 = MIGRATIONS.filter((m) => m.version <= 22);
    for (const m of upTo22) await db.batch(m.statements.map((sql) => ({ sql, args: [] })));
    await db.execute('CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at INTEGER NOT NULL)');
    for (const m of upTo22) await db.execute({ sql: 'INSERT INTO schema_migrations VALUES (?, ?, 0)', args: [m.version, m.name] });

    await reserve(db, 978);
    await reserve(db, 840);
    await db.execute('DELETE FROM reserves WHERE id = 2');
    await db.execute(`INSERT INTO goals (type, period, currency, amount, count_taxes, created_at) VALUES ('budget', 'month', 980, 500, 0, 0)`);
    await db.execute(`INSERT INTO goal_fixed (goal_id, category, amount) VALUES (1, 'аренда жилья', 100)`);
    await limit(db, 840, 'кафе и рестораны');
    await db.execute('DELETE FROM goals WHERE id = 2');

    expect(await migrate(db, 0)).toEqual([23, 24]);
    expect((await db.execute('SELECT id, currency FROM reserves')).rows.map((r) => [Number(r.id), Number(r.currency)])).toEqual([[1, 978]]);
    const budget = (await db.execute('SELECT currency, amount, count_taxes FROM goals WHERE id = 1')).rows[0];
    expect([Number(budget?.currency), Number(budget?.amount), Number(budget?.count_taxes)]).toEqual([980, 500, 0]);
    expect(Number((await db.execute('SELECT COUNT(*) AS n FROM goal_fixed WHERE goal_id = 1')).rows[0]?.n)).toBe(1);
    expect((await db.execute('PRAGMA foreign_key_check')).rows).toEqual([]);

    // A deleted id is not reused.
    expect(Number((await reserve(db, 203)).rows[0]?.id)).toBe(3);
    expect(Number((await limit(db, 203, 'кафе и рестораны')).rows[0]?.id)).toBe(3);
    // One limit per category, period and owner, as before.
    await expect(limit(db, 980, 'кафе и рестораны')).rejects.toThrow();
    // The fixed rows still go with their budget.
    await db.execute('DELETE FROM goals WHERE id = 1');
    expect(Number((await db.execute('SELECT COUNT(*) AS n FROM goal_fixed')).rows[0]?.n)).toBe(0);
  });
});
