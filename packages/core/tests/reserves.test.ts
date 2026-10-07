// Reserves (reserves.ts): add, list, change, delete; what is refused, by the code and by the table.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Db } from '../src/db.ts';
import { addReserve, deleteReserve, listReserves, ReserveError, RESERVES_MAX, updateReserve, type ReserveInput } from '../src/reserves.ts';
import { memoryDb } from './helpers.ts';

let db: Db;
beforeEach(async () => {
  db = await memoryDb();
});
afterEach(() => db.close());

const FLAT: ReserveInput = { name: '  Квартира ', currency: 978, amount: 120_000, until: null };

describe('reserves', () => {
  it('add (name trimmed), list oldest first, change, delete', async () => {
    const a = await addReserve(db, FLAT, 100);
    const b = await addReserve(db, { name: 'Навчання', currency: 980, amount: 2_000_000, until: '2026-12-01' }, 200);
    expect(a).toEqual({ id: a.id, name: 'Квартира', currency: 978, amount: 120_000, until: null });
    expect(await listReserves(db)).toEqual([a, b]);

    const changed = await updateReserve(db, a.id, { name: 'Оренда', currency: 840, amount: 0, until: '2027-01-31' });
    expect(changed).toEqual({ id: a.id, name: 'Оренда', currency: 840, amount: 0, until: '2027-01-31' });
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
