// Migration 24 (goal_excluded): «count taxes» off becomes a taxes exclusion; on, or from before v21, leaves none; the
// table goes with its budget.
import { afterEach, describe, expect, it } from 'vitest';
import { openLibsql } from '@mono/db-libsql';
import { CATEGORY } from '../../src/derive/categories.ts';
import { migrate, type Db } from '../../src/storage/db.ts';
import { MIGRATIONS } from '../../src/storage/migrations.ts';
import { listGoals } from '../../src/read/goals.ts';

const open: Db[] = [];
afterEach(() => {
  for (const d of open.splice(0)) d.close();
});

async function dbAt(version: number): Promise<Db> {
  const db = await openLibsql(':memory:');
  open.push(db);
  const done = MIGRATIONS.filter((m) => m.version <= version);
  for (const m of done) await db.batch(m.statements.map((sql) => ({ sql, args: [] })));
  await db.execute('CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at INTEGER NOT NULL)');
  for (const m of done) await db.execute({ sql: 'INSERT INTO schema_migrations VALUES (?, ?, 0)', args: [m.version, m.name] });
  return db;
}

const person = async (db: Db, label: string) =>
  Number((await db.execute({ sql: `INSERT INTO participants (label, label_source, created_at) VALUES (?, 'user', 0) RETURNING id`, args: [label] })).rows[0]?.id);

describe('migration 24', () => {
  it('a budget saved with taxes off excludes taxes; one saved with them on excludes nothing', async () => {
    const db = await dbAt(23);
    const a = await person(db, 'Вигадана Особа');
    await db.execute(`INSERT INTO goals (type, period, currency, amount, count_taxes, created_at) VALUES ('budget', 'month', 980, 500, 0, 0)`);
    await db.execute({ sql: `INSERT INTO goals (type, period, currency, amount, participant_id, count_taxes, created_at) VALUES ('budget', 'month', 980, 700, ?, 1, 0)`, args: [a] });
    await db.execute(`INSERT INTO goals (type, category, period, currency, amount, count_taxes, created_at) VALUES ('limit', 'кафе и рестораны', 'month', 980, 100, 0, 0)`);
    expect(await migrate(db, 0)).toEqual([24]);
    const goals = await listGoals(db);
    expect(goals.map((g) => (g.type === 'budget' ? g.excluded : null))).toEqual([[CATEGORY.taxes], [], null]);
    expect((await db.execute('SELECT COUNT(*) AS n FROM goal_excluded')).rows[0]?.n).toBe(1);
  });

  it('a budget from before v21 (no count_taxes yet) reads with no exclusions', async () => {
    const db = await dbAt(20);
    await db.execute(`INSERT INTO goals (type, period, currency, amount, created_at) VALUES ('budget', 'month', 980, 500, 0)`);
    expect(await migrate(db, 0)).toEqual([21, 22, 23, 24]);
    expect(await listGoals(db)).toMatchObject([{ type: 'budget', excluded: [] }]);
  });

  it('the exclusions go with their budget', async () => {
    const db = await dbAt(23);
    await db.execute(`INSERT INTO goals (type, period, currency, amount, count_taxes, created_at) VALUES ('budget', 'month', 980, 500, 0, 0)`);
    await migrate(db, 0);
    await db.execute('DELETE FROM goals WHERE id = 1');
    expect((await db.execute('SELECT COUNT(*) AS n FROM goal_excluded')).rows[0]?.n).toBe(0);
  });
});
