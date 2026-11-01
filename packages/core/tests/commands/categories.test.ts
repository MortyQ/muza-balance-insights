// The user's own categories (manual_categories, payee_categories): their order in the derivation, and that no
// import or re-derivation ever writes, duplicates or loses them. Fictional statement and rows only.
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import {
  CHOOSABLE_CATEGORIES,
  CategoryChoiceError,
  categorySources,
  setOperationCategory,
  setPayeeCategory,
} from '../../src/commands/categories.ts';
import { CATEGORY, categorize } from '../../src/derive/categories.ts';
import { rederiveCore } from '../../src/derive/rederive.ts';
import { commitStatement } from '../../src/ingest/statement-import.ts';
import { addConnection, addParticipant } from '../../src/people/participants.ts';
import { monobankCardReader } from '../../src/providers/monobank/statement.ts';
import type { ParsedStatement } from '../../src/providers/types.ts';
import type { Db } from '../../src/storage/db.ts';
import { insertAccount, insertTransactionRow, memoryDb } from '../helpers.ts';

let db: Db;
afterEach(() => db?.close());

const card = (): ParsedStatement => {
  const r = monobankCardReader.read({
    format: 'text',
    text: readFileSync(new URL('../providers/monobank/fixtures/statement-card-uk.csv', import.meta.url), 'utf8'),
  });
  if (!r.ok) throw new Error(r.problem);
  return r.statements[0]!;
};
const rows = async (sql: string, args: Array<string | number> = []) => (await db.execute({ sql, args })).rows;
const categoryOf = async (id: string) => String((await rows('SELECT category FROM transactions WHERE id = ?', [id]))[0]?.category);

const base = {
  description: 'Вигаданий Маркет',
  mcc: 5411,
  bankCategory: null,
  counterName: null,
  isInternalTransfer: false,
  isFamilyTransfer: false,
  provider: 'monobank',
} as const;

describe('categorize with the user choices', () => {
  const choices = {
    byId: new Map([['t1', CATEGORY.rent]]),
    byPayee: new Map([[`description\u0000вигаданий маркет`, CATEGORY.investments]]),
  };

  it('a choice for the operation beats its payee and the MCC; a payee choice beats the MCC', () => {
    expect(categorize({ ...base, id: 't1', amount: -100 }, [], choices)).toBe(CATEGORY.rent);
    expect(categorize({ ...base, id: 't2', amount: -100 }, [], choices)).toBe(CATEGORY.investments);
    expect(categorize({ ...base, id: 't3', amount: -100, description: 'Інший Маркет' }, [], choices)).toBe(CATEGORY.groceries);
  });

  it('applies to debits only, never to transfers between own or family accounts', () => {
    expect(categorize({ ...base, id: 't1', amount: 100 }, [], choices)).toBe(CATEGORY.groceries);
    expect(categorize({ ...base, id: 't1', amount: -100, isInternalTransfer: true }, [], choices)).toBe(CATEGORY.ownTransfers);
    expect(categorize({ ...base, id: 't1', amount: -100, isFamilyTransfer: true }, [], choices)).toBe(CATEGORY.family);
  });

  it('the payee is the counterparty name when there is one, case and spaces aside', () => {
    const byName = { byId: new Map<string, string>(), byPayee: new Map([[`counter_name\u0000вигадана особа`, CATEGORY.kids]]) };
    expect(categorize({ ...base, amount: -100, counterName: '  Вигадана ОСОБА ' }, [], byName)).toBe(CATEGORY.kids);
  });
});

describe('the new categories', () => {
  it('are choosable spending categories; income and the derived-only ones are not', () => {
    for (const c of [CATEGORY.rent, CATEGORY.car, CATEGORY.kids, CATEGORY.subscriptions, CATEGORY.investments]) {
      expect(CHOOSABLE_CATEGORIES).toContain(c);
    }
    for (const c of [CATEGORY.income, CATEGORY.ownTransfers, CATEGORY.fees, CATEGORY.transferFees, CATEGORY.family]) {
      expect(CHOOSABLE_CATEGORIES).not.toContain(c);
    }
  });
});

describe('commands', () => {
  async function seeded(): Promise<void> {
    db = await memoryDb();
    await insertAccount(db, 'a');
    const row = {
      account_id: 'a', local_date: '2026-10-01', mcc: 5411, hold: 0, currency_code: 980, commission_rate: 0, synced_at: 0,
      category: CATEGORY.groceries, description: 'Вигаданий Маркет',
    };
    await insertTransactionRow(db, { ...row, id: 'd1', time: 1000, amount: -5000 });
    await insertTransactionRow(db, { ...row, id: 'd2', time: 2000, amount: -7000 });
    await insertTransactionRow(db, { ...row, id: 'd3', time: 3000, amount: -9000 });
    await insertTransactionRow(db, { ...row, id: 'c1', time: 4000, amount: 9000, mcc: 4829, category: CATEGORY.income });
    await insertTransactionRow(db, { ...row, id: 'x1', time: 5000, amount: -1000, description: 'Інший Маркет' });
  }

  it('one operation: set, then removed, returns the automatic category', async () => {
    await seeded();
    expect(await setOperationCategory(db, 'd1', CATEGORY.rent, 10)).toEqual({ changed: 1 });
    expect(await categoryOf('d1')).toBe(CATEGORY.rent);
    expect((await categorySources(db, ['d1', 'd2'])).get('d1')).toBe('operation');
    expect(await setOperationCategory(db, 'd1', null, 11)).toEqual({ changed: 1 });
    expect(await categoryOf('d1')).toBe(CATEGORY.groceries);
  });

  it('a payee: every debit of it, with the count; its credit stays income; an own choice wins', async () => {
    await seeded();
    await setOperationCategory(db, 'd1', CATEGORY.kids, 10);
    expect(await setPayeeCategory(db, 'd2', CATEGORY.investments, 11)).toEqual({ changed: 2 });
    expect(await categoryOf('d1')).toBe(CATEGORY.kids);
    expect(await categoryOf('d2')).toBe(CATEGORY.investments);
    expect(await categoryOf('d3')).toBe(CATEGORY.investments);
    expect(await categoryOf('c1')).toBe(CATEGORY.income);
    expect(await categoryOf('x1')).toBe(CATEGORY.groceries);
    const sources = await categorySources(db, ['d1', 'd3', 'x1', 'c1']);
    expect([...sources.entries()].sort()).toEqual([['c1', 'auto'], ['d1', 'operation'], ['d3', 'payee'], ['x1', 'auto']]);

    expect(await setPayeeCategory(db, 'd3', null, 12)).toEqual({ changed: 2 });
    expect(await categoryOf('d3')).toBe(CATEGORY.groceries);
  });

  it('refuses a credit, an own transfer, an unknown operation and a category that is not choosable', async () => {
    await seeded();
    await insertTransactionRow(db, {
      id: 'o1', account_id: 'a', local_date: '2026-10-01', time: 6000, amount: -100, hold: 0, currency_code: 980, synced_at: 0,
      description: '', mcc: 4829, is_internal_transfer: 1, category: CATEGORY.ownTransfers,
    });
    await expect(setOperationCategory(db, 'c1', CATEGORY.rent, 1)).rejects.toBeInstanceOf(CategoryChoiceError);
    await expect(setOperationCategory(db, 'o1', CATEGORY.rent, 1)).rejects.toBeInstanceOf(CategoryChoiceError);
    await expect(setOperationCategory(db, 'nope', CATEGORY.rent, 1)).rejects.toBeInstanceOf(CategoryChoiceError);
    await expect(setOperationCategory(db, 'd1', CATEGORY.income, 1)).rejects.toBeInstanceOf(CategoryChoiceError);
    await expect(setPayeeCategory(db, 'd1', 'вигадана', 1)).rejects.toBeInstanceOf(CategoryChoiceError);
    expect(await rows('SELECT * FROM manual_categories')).toEqual([]);
  });
});

describe('the choices survive imports', () => {
  async function uploaded(): Promise<{ conn: number; debits: string[] }> {
    db = await memoryDb();
    const me = await addParticipant(db, { label: 'Вигадана Особа' }, 0);
    const conn = await addConnection(db, me, 'monobank', 0, 'file');
    await commitStatement(db, conn, [card()], [{ kind: 'new', id: 'c', type: null }], 1);
    const debits = (await rows(`SELECT id FROM transactions WHERE amount < 0 AND is_internal_transfer = 0 ORDER BY time`)).map((r) => String(r.id));
    expect(debits.length).toBeGreaterThan(1);
    return { conn, debits };
  }

  const snapshot = async () => rows('SELECT id, category, description, amount, time FROM transactions ORDER BY id');

  it('the same statement again: no duplicate, the choice and the row stay as they were', async () => {
    const { conn, debits } = await uploaded();
    await setOperationCategory(db, debits[0]!, CATEGORY.subscriptions, 5);
    const before = await snapshot();
    expect(await commitStatement(db, conn, [card()], [{ kind: 'account', accountId: 'c' }], 6)).toEqual({ added: 0 });
    expect(await snapshot()).toEqual(before);
    expect(await categoryOf(debits[0]!)).toBe(CATEGORY.subscriptions);
    expect(await rows('SELECT transaction_id, category FROM manual_categories')).toEqual([
      { transaction_id: debits[0]!, category: CATEGORY.subscriptions },
    ]);
  });

  it('an overlapping statement: the old row keeps its choice, a new debit of the payee follows the payee choice', async () => {
    const { conn, debits } = await uploaded();
    await setOperationCategory(db, debits[0]!, CATEGORY.car, 5);
    const later = card();
    const last = later.rows.at(-1)!;
    later.rows = [...later.rows, { ...last, time: last.time + 86_400, amount: -4200, balance: (last.balance ?? 0) - 4200, description: 'Вигаданий Брокер', mcc: 6211 }];
    later.closingBalance = (last.balance ?? 0) - 4200;
    await commitStatement(db, conn, [later], [{ kind: 'account', accountId: 'c' }], 6);
    const broker = String((await rows(`SELECT id FROM transactions WHERE description = 'Вигаданий Брокер'`))[0]?.id);
    await setPayeeCategory(db, broker, CATEGORY.investments, 7);

    const again = card();
    again.rows = [...later.rows, { ...later.rows.at(-1)!, time: last.time + 2 * 86_400, amount: -1000, balance: (later.closingBalance ?? 0) - 1000 }];
    again.closingBalance = (later.closingBalance ?? 0) - 1000;
    await commitStatement(db, conn, [again], [{ kind: 'account', accountId: 'c' }], 8);

    expect(await categoryOf(debits[0]!)).toBe(CATEGORY.car);
    const brokers = await rows(`SELECT category FROM transactions WHERE description = 'Вигаданий Брокер'`);
    expect(brokers.map((r) => r.category)).toEqual([CATEGORY.investments, CATEGORY.investments]);
  });

  it('a full re-derivation keeps every choice', async () => {
    const { debits } = await uploaded();
    await setOperationCategory(db, debits[0]!, CATEGORY.rent, 5);
    await setPayeeCategory(db, debits[1]!, CATEGORY.kids, 6);
    const before = await snapshot();
    await rederiveCore(db);
    expect(await snapshot()).toEqual(before);
    expect(await categoryOf(debits[0]!)).toBe(CATEGORY.rent);
    expect(await categoryOf(debits[1]!)).toBe(CATEGORY.kids);
  });
});
