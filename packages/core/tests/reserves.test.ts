// Reserves (reserves.ts): add, list, change, delete; whose; what is refused, by the code and by the table; migration 14.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openLibsql } from '@mono/db-libsql';
import { MIGRATIONS, migrate, type Db } from '../src/db.ts';
import { addReserve, deleteReserve, listReserves, ReserveError, RESERVES_MAX, updateReserve, type ReserveInput } from '../src/reserves.ts';
import { memoryDb } from './helpers.ts';

let db: Db;
beforeEach(async () => {
  db = await memoryDb();
});
afterEach(() => db.close());

const FLAT: ReserveInput = { name: '  Квартира ', currency: 978, amount: 120_000, until: null, participantId: null };

describe('reserves', () => {
  it('add (name trimmed), list oldest first, change, delete', async () => {
    const a = await addReserve(db, FLAT, 100);
    const b = await addReserve(db, { name: 'Навчання', currency: 980, amount: 2_000_000, until: '2026-12-01', participantId: null }, 200);
    expect(a).toEqual({ id: a.id, name: 'Квартира', currency: 978, amount: 120_000, until: null, participantId: null });
    expect(await listReserves(db)).toEqual([a, b]);

    const changed = await updateReserve(db, a.id, { name: 'Оренда', currency: 840, amount: 0, until: '2027-01-31', participantId: null });
    expect(changed).toEqual({ id: a.id, name: 'Оренда', currency: 840, amount: 0, until: '2027-01-31', participantId: null });
    await deleteReserve(db, b.id);
    expect(await listReserves(db)).toEqual([changed]);
  });

  it('refuses a bad name, currency, amount or date, an unknown id, more than the limit', async () => {
    for (const bad of [
      { ...FLAT, name: '   ' },
      { ...FLAT, name: 'x'.repeat(61) },
      { ...FLAT, currency: 826 as never },
      { ...FLAT, amount: -1 },
      { ...FLAT, amount: 1.5 },
      { ...FLAT, amount: 10_000_000_001 },
      { ...FLAT, until: '2026-02-30' },
      { ...FLAT, until: '1.12.2026' },
    ]) {
      await expect(addReserve(db, bad, 0)).rejects.toThrow(ReserveError);
    }
    expect(await addReserve(db, { ...FLAT, name: 'я'.repeat(60) }, 0)).toMatchObject({ name: 'я'.repeat(60) });
    await expect(updateReserve(db, 999, FLAT)).rejects.toThrow(ReserveError);
    await expect(deleteReserve(db, 999)).rejects.toThrow(ReserveError);

    for (let i = 1; i < RESERVES_MAX; i++) await addReserve(db, FLAT, 0);
    await expect(addReserve(db, FLAT, 0)).rejects.toThrow(ReserveError);
    expect(await listReserves(db)).toHaveLength(RESERVES_MAX);
  });

  it('whose: a person or common; an unknown person refused; a removed person\'s reserves become common', async () => {
    const her = Number((await db.execute(`INSERT INTO participants (label, created_at) VALUES ('Вигадана', 0) RETURNING id`)).rows[0]?.id);
    const r = await addReserve(db, { ...FLAT, participantId: her }, 0);
    expect(r.participantId).toBe(her);
    expect((await updateReserve(db, r.id, { ...FLAT, participantId: null })).participantId).toBeNull();
    await updateReserve(db, r.id, { ...FLAT, participantId: her });
    await expect(addReserve(db, { ...FLAT, participantId: 999 }, 0)).rejects.toThrow(ReserveError);
    await expect(updateReserve(db, r.id, { ...FLAT, participantId: 999 })).rejects.toThrow(ReserveError);
    await expect(addReserve(db, { ...FLAT, participantId: 1.5 }, 0)).rejects.toThrow(ReserveError);

    await db.execute({ sql: 'DELETE FROM participants WHERE id = ?', args: [her] });
    expect((await listReserves(db))[0]?.participantId).toBeNull();
  });

  it('the table refuses what the code would, on its own', async () => {
    const insert = (name: string, currency: number, amount: number, until: string | null) =>
      db.execute({ sql: 'INSERT INTO reserves (name, currency, amount, until, created_at) VALUES (?, ?, ?, ?, 0)', args: [name, currency, amount, until] });
    await expect(insert('', 980, 1, null)).rejects.toThrow();
    await expect(insert('x', 826, 1, null)).rejects.toThrow();
    await expect(insert('x', 980, -1, null)).rejects.toThrow();
    await expect(insert('x', 980, 1, 'soon')).rejects.toThrow();
    await insert('x', 980, 1, '2026-10-07');
  });
});

describe('migration v14', () => {
  async function at13(people: string[]) {
    const old = await openLibsql(':memory:');
    const upTo13 = MIGRATIONS.filter((m) => m.version <= 13);
    for (const m of upTo13) await old.batch(m.statements.map((sql) => ({ sql, args: [] })));
    await old.execute('CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at INTEGER NOT NULL)');
    for (const m of upTo13) await old.execute({ sql: 'INSERT INTO schema_migrations VALUES (?, ?, 0)', args: [m.version, m.name] });
    await old.execute('DELETE FROM participants');
    for (const p of people) await old.execute({ sql: 'INSERT INTO participants (label, created_at) VALUES (?, 0)', args: [p] });
    await old.execute(`INSERT INTO reserves (name, currency, amount, until, created_at) VALUES ('Квартира', 978, 100, NULL, 0)`);
    return old;
  }

  it('one person: the reserves so far become theirs', async () => {
    const old = await at13(['Я']);
    expect(await migrate(old, 0)).toEqual([14]);
    const me = Number((await old.execute('SELECT id FROM participants')).rows[0]?.id);
    expect((await listReserves(old))[0]?.participantId).toBe(me);
    old.close();
  });

  it('a family: they stay common', async () => {
    const old = await at13(['Я', 'Вигадана']);
    expect(await migrate(old, 0)).toEqual([14]);
    expect((await listReserves(old))[0]?.participantId).toBeNull();
    old.close();
  });
});
