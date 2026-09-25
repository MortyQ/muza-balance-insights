import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { recategorize } from '../src/categories.ts';
import type { Db } from '../src/db.ts';
import { spendingByCategory, transferDiagnostics } from '../src/queries.ts';
import { detectTransfers, markInternalTransfers, type TransferAccount, type TransferTx } from '../src/transfers.ts';
import { insertAccount, memoryDb } from './helpers.ts';

// The nine January–February black → white transfers from the phase 3 report (amounts in kopecks):
// black debit = white credit + 4 % commission. Feb 19 has three of them within 50 s.
const FEE_TRANSFERS: Array<{ t: number; out: number; fee: number; dtIn?: number }> = [
  { t: 1_767_639_805, out: 104_000, fee: 4_000 },
  { t: 1_767_723_274, out: 10_400, fee: 400 },
  { t: 1_768_128_509, out: 62_400, fee: 2_400 },
  { t: 1_769_254_090, out: 31_200, fee: 1_200 },
  { t: 1_770_229_440, out: 36_400, fee: 1_400 },
  { t: 1_771_512_889, out: 31_200, fee: 1_200 },
  { t: 1_771_512_928, out: 12_480, fee: 480 },
  { t: 1_771_512_939, out: 208, fee: 8 },
  { t: 1_771_666_517, out: 20_800, fee: 800 },
];

let db: Db;

beforeEach(async () => {
  db = await memoryDb();
  await insertAccount(db, 'black', 'card', 980);
  await insertAccount(db, 'white', 'card', 980);
  await insertAccount(db, 'usd', 'card', 840);
});

afterEach(() => db.close());

async function insertTx(
  id: string,
  accountId: string,
  time: number,
  amount: number,
  opts: { mcc?: number; description?: string; commission?: number; category?: string; localDate?: string } = {},
) {
  await db.execute({
    sql: `INSERT INTO transactions (id, account_id, time, local_date, description, mcc, hold, amount, operation_amount,
            currency_code, commission_rate, category, raw_json, synced_at)
          VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, 980, ?, ?, '{}', 0)`,
    args: [
      id, accountId, time, opts.localDate ?? '2026-01-15', opts.description ?? '', opts.mcc ?? 4829,
      amount, amount, opts.commission ?? 0, opts.category ?? 'другое',
    ],
  });
}

async function seedFeeTransfers() {
  for (const [i, f] of FEE_TRANSFERS.entries()) {
    await insertTx(`out${i}`, 'black', f.t, -f.out, { description: 'Переказ на картку', commission: f.fee });
    await insertTx(`in${i}`, 'white', f.t, f.out - f.fee, { description: 'З Чорної картки' });
  }
}

describe('pair_fee', () => {
  it('pairs debit = credit + commission (pure), one-to-one, only with a positive commission', () => {
    const accounts: TransferAccount[] = [
      { id: 'black', kind: 'card', currencyCode: 980, iban: null, title: null, provider: 'monobank', participantId: 1 },
      { id: 'white', kind: 'card', currencyCode: 980, iban: null, title: null, provider: 'monobank', participantId: 1 },
    ];
    const tx = (id: string, acc: string, amount: number, commissionRate = 0): TransferTx => ({
      id, accountId: acc, time: 100, amount, operationAmount: amount, commissionRate, mcc: 4829, description: '', counterIban: null,
    });
    const marks = detectTransfers([tx('o', 'black', -104_000, 4_000), tx('i', 'white', 100_000)], accounts);
    expect(marks.get('o')).toEqual({ rule: 'pair_fee', pairId: 'i' });
    const noFee = detectTransfers([tx('o', 'black', -104_000, 0), tx('i', 'white', 100_000)], accounts);
    expect(noFee.get('o')).toBeUndefined();
  });

  it('the nine January–February black → white transfers pair up (incl. three within 50 s)', async () => {
    await seedFeeTransfers();
    await markInternalTransfers(db);
    for (const i of FEE_TRANSFERS.keys()) {
      const rs = await db.execute({ sql: 'SELECT transfer_rule, transfer_pair_id FROM transactions WHERE id = ?', args: [`out${i}`] });
      expect(rs.rows[0], `out${i}`).toMatchObject({ transfer_rule: 'pair_fee', transfer_pair_id: `in${i}` });
    }
    const d = await transferDiagnostics(db);
    expect(d.byRule.pair_fee).toBe(18);
    expect(d.unpairedService4829).toBe(0);
  });

  it('their commission (118.88 ₴) is spending in «комиссии банка»; the transfer bodies are not', async () => {
    await seedFeeTransfers();
    await markInternalTransfers(db);
    await recategorize(db);
    const rows = await spendingByCategory(db, '2026-01-01', '2026-02-28');
    expect(rows).toEqual([{ currency: 980, category: 'комиссии банка', lines: 9, gross: 11_888, refunds: 0, net: 11_888 }]);
  });
});

describe('spendingByCategory', () => {
  it('splits a P2P transfer with a commission into body and commission', async () => {
    await insertTx('p2p', 'black', 1, -72_312, { commission: 2_312, description: 'Вигаданий О.' });
    await recategorize(db);
    const rows = await spendingByCategory(db, '2026-01-01', '2026-01-31');
    expect(rows).toEqual([
      { currency: 980, category: 'переводы людям', lines: 1, gross: 70_000, refunds: 0, net: 70_000 },
      { currency: 980, category: 'комиссии банка', lines: 1, gross: 2_312, refunds: 0, net: 2_312 },
    ]);
  });

  it('keeps gross, refunds and net per category; income and internal transfers are excluded', async () => {
    await insertTx('buy', 'black', 1, -100_000, { mcc: 5411 });
    await insertTx('refund', 'black', 2, 30_000, { mcc: 5411 });
    await insertTx('salary', 'white', 3, 500_000, { description: 'Від: Компанія' });
    await insertTx('own', 'black', 4, -7_000, { description: 'На білу картку' });
    await insertTx('ownIn', 'white', 4, 7_000, { description: 'З Чорної картки' });
    await markInternalTransfers(db);
    await recategorize(db);
    const rows = await spendingByCategory(db, '2026-01-01', '2026-01-31');
    expect(rows).toEqual([{ currency: 980, category: 'продукты', lines: 2, gross: 100_000, refunds: 30_000, net: 70_000 }]);
  });

  it('never sums different account currencies and respects the date range', async () => {
    await insertTx('uah', 'black', 1, -10_000, { mcc: 5411 });
    await insertTx('usd', 'usd', 2, -2_500, { mcc: 5411 });
    await insertTx('later', 'black', 3, -99_999, { mcc: 5411, localDate: '2026-02-01' });
    await recategorize(db);
    const rows = await spendingByCategory(db, '2026-01-01', '2026-01-31');
    expect(rows).toEqual([
      { currency: 840, category: 'продукты', lines: 1, gross: 2_500, refunds: 0, net: 2_500 },
      { currency: 980, category: 'продукты', lines: 1, gross: 10_000, refunds: 0, net: 10_000 },
    ]);
  });
});

describe('migration v5', () => {
  it("accepts transfer_rule 'pair_fee' and still rejects unknown rules", async () => {
    await insertTx('a', 'black', 1, -100);
    await db.execute(`UPDATE transactions SET transfer_rule = 'pair_fee' WHERE id = 'a'`);
    await expect(db.execute(`UPDATE transactions SET transfer_rule = 'bogus' WHERE id = 'a'`)).rejects.toThrow();
  });
});
