import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { categorize, recategorize, type CategorizeInput, type CategoryOverride } from '../src/categories.ts';
import type { Db } from '../src/db.ts';
import { insertAccount, memoryDb } from './helpers.ts';

const base: CategorizeInput = { description: '', mcc: 5411, amount: -100, counterName: null, isInternalTransfer: false };
const cat = (over: Partial<CategorizeInput>, overrides: CategoryOverride[] = []) => categorize({ ...base, ...over }, overrides);

describe('categorize', () => {
  it('maps observed MCCs and falls back to «другое»', () => {
    expect(cat({ mcc: 5411 })).toBe('продукты');
    expect(cat({ mcc: 5814 })).toBe('кафе и рестораны');
    expect(cat({ mcc: 4121 })).toBe('такси и транспорт');
    expect(cat({ mcc: 9311 })).toBe('налоги и госплатежи');
    expect(cat({ mcc: 1234 })).toBe('другое');
  });

  it('MCC 6012 split by sign; 8398 → «благотворительность»; ambiguous codes stay in «другое»', () => {
    expect(cat({ mcc: 6012, amount: -225_396 })).toBe('рассрочки и кредиты');
    expect(cat({ mcc: 6012, amount: 150_000, description: 'Від: Банк' })).toBe('поступления');
    expect(cat({ mcc: 8398 })).toBe('благотворительность');
    for (const mcc of [7399, 5999, 8999, 7299, 5311, 5331, 5399, 2791]) expect(cat({ mcc })).toBe('другое');
  });

  it('internal transfers win over everything', () => {
    expect(cat({ mcc: 4829, isInternalTransfer: true, counterName: 'Олег' }, [
      { pattern: 'Олег', matchType: 'exact', category: 'подарки' },
    ])).toBe('свои переводы');
  });

  it('MCC 4829: P2P out, income in, treasury → taxes', () => {
    expect(cat({ mcc: 4829, amount: -1000, description: 'Вигаданий О.' })).toBe('переводы людям');
    expect(cat({ mcc: 4829, amount: 1000, description: 'Від: Компанія' })).toBe('поступления');
    expect(cat({ mcc: 4829, amount: -700, description: 'ГУК Харків обл/18050400' })).toBe('налоги и госплатежи');
  });

  it('installment payments → «рассрочки и кредиты», not P2P', () => {
    expect(cat({ mcc: 4829, amount: -45_804, description: 'Щомісячний платіж ' })).toBe('рассрочки и кредиты');
  });

  it('overrides by counter_name: exact beats contains, longest contains wins, case-insensitive', () => {
    const overrides: CategoryOverride[] = [
      { pattern: 'уніка', matchType: 'contains', category: 'страхование' },
      { pattern: 'СК Уніка', matchType: 'contains', category: 'страхование авто' },
      { pattern: 'Тестовий Контакт', matchType: 'exact', category: 'аренда' },
    ];
    expect(cat({ mcc: 4829, counterName: 'ПРАТ "СК Уніка"' }, overrides)).toBe('страхование авто');
    expect(cat({ mcc: 4829, counterName: 'тестовий контакт' }, overrides)).toBe('аренда');
    expect(cat({ mcc: 4829, counterName: 'Тестовий Контакт молодший' }, overrides)).toBe('переводы людям');
    expect(cat({ mcc: 4829, counterName: null }, overrides)).toBe('переводы людям');
  });
});

describe('recategorize (DB)', () => {
  let db: Db;
  beforeEach(async () => {
    db = await memoryDb();
    await insertAccount(db, 'black');
  });
  afterEach(() => db.close());

  it('uses category_overrides and writes only changed rows', async () => {
    const ins = (id: string, mcc: number, amount: number, counter: string | null, internal = 0) =>
      db.execute({
        sql: `INSERT INTO transactions (id, account_id, time, local_date, description, mcc, hold, amount, currency_code,
                counter_name, is_internal_transfer, raw_json, synced_at)
              VALUES (?, 'black', 1, '2026-08-05', '', ?, 0, ?, 980, ?, ?, '{}', 0)`,
        args: [id, mcc, amount, counter, internal],
      });
    await ins('shop', 5411, -100, null);
    await ins('p2p', 4829, -500, 'Тестова Особа');
    await ins('own', 4829, -500, null, 1);
    await db.execute(`INSERT INTO category_overrides (pattern, match_type, category) VALUES ('Тестова Особа', 'exact', 'подарки')`);

    expect(await recategorize(db)).toBe(3);
    const rows = await db.execute('SELECT id, category FROM transactions ORDER BY id');
    expect(Object.fromEntries(rows.rows.map((r) => [String(r.id), String(r.category)]))).toEqual({
      own: 'свои переводы',
      p2p: 'подарки',
      shop: 'продукты',
    });
    expect(await recategorize(db)).toBe(0);
  });
});
