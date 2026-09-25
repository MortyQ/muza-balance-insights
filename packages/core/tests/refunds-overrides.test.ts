import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { recategorize } from '../src/categories.ts';
import type { Db } from '../src/db.ts';
import { OverrideError, addOverride, listOverrides, overrideCandidates, removeOverride } from '../src/overrides.ts';
import { spendingByCategory, transferDiagnostics } from '../src/queries.ts';
import { REFUND_WINDOW_SEC, detectRefunds, markRefunds, type RefundTx } from '../src/refunds.ts';
import { markInternalTransfers } from '../src/transfers.ts';
import { insertAccount, memoryDb } from './helpers.ts';

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
  opts: { mcc?: number; description?: string; counterName?: string; localDate?: string } = {},
) {
  await db.execute({
    sql: `INSERT INTO transactions (id, account_id, time, local_date, description, mcc, hold, amount, operation_amount,
            currency_code, counter_name, raw_json, synced_at)
          VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, 980, ?, '{}', 0)`,
    args: [id, accountId, time, opts.localDate ?? '2026-05-22', opts.description ?? '', opts.mcc ?? 5411, amount, amount, opts.counterName ?? null],
  });
}

async function col(id: string, column: string) {
  const rs = await db.execute({ sql: `SELECT ${column} AS v FROM transactions WHERE id = ?`, args: [id] });
  return rs.rows[0]?.v ?? null;
}

async function derive() {
  await markInternalTransfers(db);
  await markRefunds(db);
  await recategorize(db);
}

describe('refund_pair', () => {
  const T = 1_779_448_634;

  it('the 22.05 case: a purchase with MCC 5816 and its MCC 4829 cancellation 50 s later net to zero', async () => {
    await insertTx('buy', 'black', T, -261_098, { mcc: 5816, description: 'Вигадана Гра' });
    await insertTx('back', 'black', T + 50, 261_098, { mcc: 4829, description: 'Скасування' });
    await derive();

    expect(await col('buy', 'refund_pair_id')).toBe('back');
    expect(await col('back', 'refund_pair_id')).toBe('buy');
    expect(await col('back', 'category')).toBe('связь и цифровые сервисы');
    expect(await spendingByCategory(db, '2026-05-01', '2026-05-31')).toEqual([
      { currency: 980, category: 'связь и цифровые сервисы', lines: 2, gross: 261_098, refunds: 261_098, net: 0 },
    ]);
    expect((await transferDiagnostics(db)).refundPairs).toBe(1);
  });

  it('«Від: …» with the same amount 5 minutes later is NOT a refund', async () => {
    await insertTx('buy', 'black', T, -261_098, { mcc: 5816 });
    await insertTx('gift', 'black', T + 300, 261_098, { mcc: 4829, description: 'Від: Вигадана Особа' });
    await derive();
    expect(await col('gift', 'refund_pair_id')).toBeNull();
    expect(await col('gift', 'category')).toBe('поступления');
  });

  const base = (over: Partial<RefundTx>): RefundTx => ({
    id: 'x', accountId: 'black', time: T, amount: 0, mcc: 5411, description: '', isInternal: false, ...over,
  });

  it('needs the same account, exact amount, 0…15 min after the purchase, a non-4829 purchase', () => {
    const buy = base({ id: 'buy', amount: -500 });
    const credit = (over: Partial<RefundTx>) => base({ id: 'c', amount: 500, mcc: 4829, time: T + 60, ...over });
    expect(detectRefunds([buy, credit({})]).get('c')).toBe('buy');
    expect(detectRefunds([buy, credit({ time: T + REFUND_WINDOW_SEC })]).get('c')).toBe('buy');
    expect(detectRefunds([buy, credit({ time: T + REFUND_WINDOW_SEC + 1 })]).size).toBe(0);
    expect(detectRefunds([buy, credit({ time: T - 1 })]).size).toBe(0); // credit before the purchase
    expect(detectRefunds([buy, credit({ accountId: 'white' })]).size).toBe(0);
    expect(detectRefunds([buy, credit({ amount: 499 })]).size).toBe(0);
    expect(detectRefunds([buy, credit({ mcc: 5411 })]).size).toBe(0); // same-MCC refund: category already right
    expect(detectRefunds([base({ id: 'buy', amount: -500, mcc: 4829 }), credit({})]).size).toBe(0);
    expect(detectRefunds([base({ id: 'buy', amount: -500, isInternal: true }), credit({})]).size).toBe(0);
  });

  it('one-to-one: two identical purchases, one credit → paired with the nearer one', () => {
    const m = detectRefunds([
      base({ id: 'early', amount: -500, time: T }),
      base({ id: 'late', amount: -500, time: T + 100 }),
      base({ id: 'c', amount: 500, mcc: 4829, time: T + 120 }),
    ]);
    expect(m.get('c')).toBe('late');
    expect(m.has('early')).toBe(false);
  });

  it('the DB pass looks W seconds beyond the window: a credit 10 min after the window end is found', async () => {
    await insertTx('buy', 'black', 10_000, -700, { mcc: 5812 });
    await insertTx('back', 'black', 10_600, 700, { mcc: 4829 });
    await markRefunds(db, { from: 5_000, to: 10_000 });
    expect(await col('back', 'refund_pair_id')).toBe('buy');
  });
});

describe('overrides', () => {
  async function seedP2p() {
    await insertTx('p1', 'black', 1, -100_000, { mcc: 4829, counterName: 'Тестова Особа' });
    await insertTx('p2', 'black', 2, -50_000, { mcc: 4829, counterName: 'Тестова Особа' });
    await insertTx('p3', 'black', 3, -120_000, { mcc: 4829, counterName: 'ТОВ «Вигадана Страховка»', localDate: '2026-06-01' });
    await insertTx('p4', 'usd', 4, -3_000, { mcc: 4829, counterName: 'Тестова Особа' });
    await insertTx('shop', 'black', 5, -999_999, { mcc: 5411, counterName: 'Супермаркет' });
    await recategorize(db);
  }

  it('candidates: «переводы людям» only, by total, per account currency, with row count and last date', async () => {
    await seedP2p();
    expect(await overrideCandidates(db)).toEqual([
      { counterName: 'Тестова Особа', currency: 980, rows: 2, total: 150_000, lastDate: '2026-05-22' },
      { counterName: 'ТОВ «Вигадана Страховка»', currency: 980, rows: 1, total: 120_000, lastDate: '2026-06-01' },
      { counterName: 'Тестова Особа', currency: 840, rows: 1, total: 3_000, lastDate: '2026-05-22' },
    ]);
    expect(await overrideCandidates(db, 1)).toHaveLength(1);
  });

  it('add validates the category, re-categorizes, and re-points an existing pattern', async () => {
    await seedP2p();
    await expect(addOverride(db, 'Вигадана Страховка', 'страховки')).rejects.toThrow(OverrideError);
    await expect(addOverride(db, 'x', 'свои переводы')).rejects.toThrow(OverrideError); // derived category
    await expect(addOverride(db, '   ', 'страхование')).rejects.toThrow(OverrideError);

    const r = await addOverride(db, 'Вигадана Страховка', 'страхование', 'contains');
    expect(r.changedRows).toBe(1);
    expect(await col('p3', 'category')).toBe('страхование');

    const again = await addOverride(db, 'Вигадана Страховка', 'другое', 'contains');
    expect(again.id).toBe(r.id);
    expect(await col('p3', 'category')).toBe('другое');
    expect(await listOverrides(db)).toEqual([
      { id: r.id, pattern: 'Вигадана Страховка', matchType: 'contains', category: 'другое' },
    ]);
  });

  it('remove deletes the override and restores the default category; unknown id is an error', async () => {
    await seedP2p();
    const { id } = await addOverride(db, 'Тестова Особа', 'благотворительность');
    expect(await col('p1', 'category')).toBe('благотворительность');
    expect((await removeOverride(db, id)).changedRows).toBe(3);
    expect(await col('p1', 'category')).toBe('переводы людям');
    await expect(removeOverride(db, id)).rejects.toThrow(OverrideError);
  });
});
