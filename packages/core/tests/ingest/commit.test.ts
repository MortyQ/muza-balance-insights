// commitRows with what a bank may leave out: no MCC is stored as NULL (never 0), the bank's own category is kept as
// the bank states it. Fictional data only.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Db } from '../../src/storage/db.ts';
import { commitRows } from '../../src/ingest/commit.ts';
import { insertAccount, memoryDb } from '../helpers.ts';

let db: Db;
beforeEach(async () => {
  db = await memoryDb();
  await insertAccount(db, 'black');
});
afterEach(() => db.close());

describe('commitRows', () => {
  it('stores a row without an MCC as NULL and keeps the bank category; the row is spending in «другое»', async () => {
    await commitRows(db, {
      provider: 'monobank',
      accountId: 'black',
      window: { from: 1_000, to: 2_000 },
      items: [{ id: 'r1', time: 1_500, amount: -700, currencyCode: 980, hold: false, bankCategory: 'Вигадана категорія', raw: '{}' }],
      nowSec: 3_000,
      cancelHolds: false,
    });
    const row = (await db.execute(`SELECT mcc, bank_category, category FROM transactions WHERE id = 'r1'`)).rows[0];
    expect(row).toEqual({ mcc: null, bank_category: 'Вигадана категорія', category: 'другое' });
  });
});
