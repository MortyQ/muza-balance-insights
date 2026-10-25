// Bank categories their bank's table does not know are counted in the re-derivation report (derive/diagnostics.ts,
// derive/rederive.ts). Fictional rows only.
import { describe, expect, it, vi } from 'vitest';
import { insertAccount, insertTransactionRow, memoryDb } from '../helpers.ts';
import { unknownBankCategories } from '../../src/derive/diagnostics.ts';
import { rederiveCore } from '../../src/derive/rederive.ts';
import { monobankRules } from '../../src/providers/monobank/rules.ts';

async function setup() {
  const db = await memoryDb();
  await insertAccount(db, 'a1');
  const row = (id: string, bankCategory: string | null, cancelled = 0) =>
    insertTransactionRow(db, { id, account_id: 'a1', time: 1_700_000_000, amount: -100, currency_code: 980, mcc: null, bank_category: bankCategory, is_cancelled: cancelled, hold: 0, local_date: '2023-11-14', synced_at: 0 });
  await row('t1', 'Вигадана категорія');
  await row('t2', 'Вигадана категорія');
  await row('t3', 'Відома категорія');
  await row('t4', 'Скасована категорія', 1);
  await row('t5', null);
  return db;
}

describe('unknown bank categories', () => {
  it('counts each bank category the table does not know, by bank; cancelled rows and rows without one are left out', async () => {
    const db = await setup();
    const spy = vi.spyOn(monobankRules, 'knowsBankCategory').mockImplementation((name) => name === 'Відома категорія');
    try {
      expect(await unknownBankCategories(db)).toEqual([{ provider: 'monobank', bankCategory: 'Вигадана категорія', n: 2 }]);
      const report = await rederiveCore(db);
      expect(report.slice(-2)).toEqual(['Неизвестные категории банка (строк):', '       2  monobank «Вигадана категорія»']);
    } finally {
      spy.mockRestore();
    }
  });

  it('no unknown category → no section in the report', async () => {
    const db = await setup();
    const spy = vi.spyOn(monobankRules, 'knowsBankCategory').mockReturnValue(true);
    try {
      expect((await rederiveCore(db)).some((l) => l.includes('Неизвестные категории'))).toBe(false);
    } finally {
      spy.mockRestore();
    }
  });
});
