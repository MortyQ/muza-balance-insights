import { afterEach, describe, expect, it } from 'vitest';
import { openLibsql, type LibsqlDb } from '../src/index.ts';

describe('libsql adapter', () => {
  let db: LibsqlDb;
  afterEach(() => db.close());

  it('execute returns rows by column name and rowsAffected', async () => {
    db = await openLibsql(':memory:');
    await db.execute('CREATE TABLE t (id INTEGER PRIMARY KEY, name TEXT)');
    const ins = await db.execute({ sql: 'INSERT INTO t (id, name) VALUES (?, ?), (?, ?)', args: [1, 'a', 2, 'b'] });
    expect(ins.rowsAffected).toBe(2);
    const rs = await db.execute('SELECT id, name FROM t ORDER BY id');
    expect(rs.rows.map((r) => [r.id, r.name])).toEqual([[1, 'a'], [2, 'b']]);
  });

  it('batch is one transaction: a failing statement rolls back the whole batch', async () => {
    db = await openLibsql(':memory:');
    await db.execute('CREATE TABLE t (id INTEGER PRIMARY KEY)');
    await expect(
      db.batch([
        { sql: 'INSERT INTO t (id) VALUES (?)', args: [1] },
        { sql: 'INSERT INTO t (id) VALUES (?)', args: [1] }, // duplicate key
      ]),
    ).rejects.toThrow();
    expect((await db.execute('SELECT COUNT(*) AS n FROM t')).rows[0]?.n).toBe(0);
  });

  it('foreign keys are enforced', async () => {
    db = await openLibsql(':memory:');
    await db.execute('CREATE TABLE p (id INTEGER PRIMARY KEY)');
    await db.execute('CREATE TABLE c (id INTEGER PRIMARY KEY, p INTEGER REFERENCES p(id))');
    await expect(db.execute('INSERT INTO c (id, p) VALUES (1, 42)')).rejects.toThrow();
  });
});
