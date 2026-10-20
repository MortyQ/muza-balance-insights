// The end of an import re-derives only the spans it touched (rederiveSpans), and decides when a full pass is needed
// (accountInputsChanged). Fictional data only.
import { afterEach, describe, expect, it } from 'vitest';
import type { Db } from '../src/db.ts';
import { accountInputs, accountInputsChanged } from '../src/derived.ts';
import { mergeSpans, rederiveSpans } from '../src/rederive.ts';
import { insertAccount, insertAccountRow, insertTransactionRow, memoryDb } from './helpers.ts';

let db: Db;
afterEach(() => db?.close());

describe('mergeSpans', () => {
  it('merges overlapping and touching spans, keeps apart the disjoint ones, oldest first', () => {
    expect(mergeSpans([])).toEqual([]);
    expect(mergeSpans([{ from: 50, to: 60 }, { from: 0, to: 10 }, { from: 10, to: 20 }, { from: 15, to: 18 }, { from: 21, to: 30 }])).toEqual([
      { from: 0, to: 20 },
      { from: 21, to: 30 },
      { from: 50, to: 60 },
    ]);
    expect(mergeSpans([{ from: 0, to: 100 }, { from: 5, to: 7 }])).toEqual([{ from: 0, to: 100 }]);
  });

  it('does not change the spans it is given', () => {
    const spans = [{ from: 0, to: 10 }, { from: 5, to: 20 }];
    mergeSpans(spans);
    expect(spans).toEqual([{ from: 0, to: 10 }, { from: 5, to: 20 }]);
  });
});

describe('rederiveSpans', () => {
  const T = 1_780_000_000;
  const DAY = 86_400;
  const category = async (id: string) => (await db.execute({ sql: 'SELECT category FROM transactions WHERE id = ?', args: [id] })).rows[0]?.category;

  it('re-derives the rows of the merged spans only; a row far outside keeps its stored value', async () => {
    db = await memoryDb();
    await insertAccount(db, 'black');
    for (const [id, time] of [['in-a', T], ['in-b', T + DAY], ['far', T + 200 * DAY]] as const) {
      await insertTransactionRow(db, {
        id, account_id: 'black', time, local_date: '2026-05-28', description: 'Fictional grocery', mcc: 5411, hold: 0, amount: -1000,
        currency_code: 980, synced_at: 0, category: 'stale',
      });
    }
    const r = await rederiveSpans(db, [{ from: T - 10, to: T + 10 }, { from: T, to: T + DAY + 10 }]);
    expect(r).toEqual({ spans: 1, changed: 2 });
    expect([await category('in-a'), await category('in-b'), await category('far')]).toEqual(['продукты', 'продукты', 'stale']);
  });

  it('pairs an own transfer whose halves came in different spans', async () => {
    db = await memoryDb();
    await insertAccount(db, 'black', 'card', 980, 'UA00FICTIONAL1');
    await insertAccount(db, 'white', 'card', 980, 'UA00FICTIONAL2');
    const row = (id: string, account: string, time: number, amount: number) =>
      insertTransactionRow(db, {
        id, account_id: account, time, local_date: '2026-05-28', description: 'Fictional transfer', mcc: 4829, hold: 0, amount,
        currency_code: 980, synced_at: 0,
      });
    await row('out', 'black', T, -5000);
    await row('in', 'white', T + 2, 5000);
    await rederiveSpans(db, [{ from: T - 100, to: T }, { from: T + 2, to: T + 100 }]);
    const marks = (await db.execute('SELECT id, is_internal_transfer AS i, transfer_pair_id AS p FROM transactions ORDER BY id')).rows;
    expect(marks.map((m) => [m.id, m.i, m.p])).toEqual([['in', 1, 'out'], ['out', 1, 'in']]);
  });
});

describe('accountInputsChanged', () => {
  const account = (id: string, o: { iban?: string | null; kind?: 'card' | 'jar'; title?: string | null; type?: string | null } = {}) =>
    insertAccountRow(db, {
      id, kind: o.kind ?? 'card', type: o.type === undefined ? 'black' : o.type, currency_code: 980, iban: o.iban ?? null, title: o.title ?? null,
      balance: 0, updated_at: 0,
    });
  const set = (id: string, column: 'iban' | 'title' | 'type', value: string) =>
    db.execute({ sql: `UPDATE accounts SET ${column} = ? WHERE id = ?`, args: [value, id] });

  it('the same accounts, or a new account without a new IBAN or jar title: no full pass', async () => {
    db = await memoryDb();
    await account('black', { iban: 'UA00FICTIONAL1' });
    await account('jar', { kind: 'jar', type: null, title: 'Fictional goal' });
    const before = await accountInputs(db);
    expect(accountInputsChanged(before, await accountInputs(db))).toBe(false);
    await account('white');
    expect(accountInputsChanged(before, await accountInputs(db))).toBe(false);
    // A card's title is not a jar title: the text rule reads jars only.
    await account('green', { title: 'Fictional card name' });
    expect(accountInputsChanged(before, await accountInputs(db))).toBe(false);
  });

  it('a new IBAN or jar title, or a changed IBAN, jar title or card type: a full pass', async () => {
    db = await memoryDb();
    await account('black', { iban: 'UA00FICTIONAL1' });
    await account('jar', { kind: 'jar', type: null, title: 'Fictional goal' });
    const before = await accountInputs(db);

    await account('white', { iban: 'UA00FICTIONAL2' });
    expect(accountInputsChanged(before, await accountInputs(db))).toBe(true);
    await db.execute("DELETE FROM accounts WHERE id = 'white'");

    await account('jar2', { kind: 'jar', type: null, title: 'Fictional trip' });
    expect(accountInputsChanged(before, await accountInputs(db))).toBe(true);
    await db.execute("DELETE FROM accounts WHERE id = 'jar2'");
    expect(accountInputsChanged(before, await accountInputs(db))).toBe(false);

    for (const [id, column, value] of [['black', 'iban', 'UA00FICTIONAL9'], ['jar', 'title', 'Fictional car'], ['black', 'type', 'fop']] as const) {
      db.close();
      db = await memoryDb();
      await account('black', { iban: 'UA00FICTIONAL1' });
      await account('jar', { kind: 'jar', type: null, title: 'Fictional goal' });
      const was = await accountInputs(db);
      await set(id, column, value);
      expect(accountInputsChanged(was, await accountInputs(db)), `${id}.${column}`).toBe(true);
    }
  });
});
