import { describe, expect, it } from 'vitest';
import { czIban } from '../../../src/providers/csob/iban.ts';
import { csobAccountReader } from '../../../src/providers/csob/statement.ts';
import { readers as monobankReaders } from '../../../src/providers/monobank/statement.ts';
import type { ParsedStatement, StatementDocument } from '../../../src/providers/types.ts';
import { csobDocument, type Row } from './documents.ts';
import fs from 'node:fs';

const statementOf = (doc: StatementDocument): ParsedStatement => {
  const r = csobAccountReader.read(doc);
  if (!r.ok) throw new Error(`not read: ${r.problem} ${r.row ?? ''}`);
  expect(r.statements).toHaveLength(1);
  return r.statements[0]!;
};
const one = (row: Row) => statementOf(csobDocument([row])).rows[0]!;

describe('csob-account-csv-en', () => {
  it('detects the header, and more surely with the title', () => {
    const row: Row = { date: '01.10.2026', amount: '250', type: 'Debit card transaction', category: 'Groceries' };
    expect(csobAccountReader.detect(csobDocument([row]))).toBe(2);
    expect(csobAccountReader.detect(csobDocument([row], { title: false }))).toBe(1);
    expect(csobAccountReader.detect({ format: 'text', text: 'a,b,c\n1,2,3\n' })).toBe(0);
    expect(csobAccountReader.detect({ format: 'pdf', items: [] } as unknown as StatementDocument)).toBe(0);
  });

  it('the semicolon export: bare fields, decimal commas, the same rows as the comma one', () => {
    const rows: Row[] = [
      { date: '02.10.2026', amount: '-1234,50', type: 'Debit card transaction', category: 'Groceries', note: 'Amount: 1234,50 CZK, Place: TEST MARKET PRAHA' },
      { date: '01.10.2026', amount: '61000,00', type: 'Incoming foreign payment', category: 'Income', original: '3 000,00 USD' },
    ];
    const semi = csobDocument(rows, { semicolons: true });
    expect(csobAccountReader.detect(semi)).toBe(2);
    expect(csobAccountReader.detect(csobDocument(rows, { semicolons: true, title: false }))).toBe(1);
    const a = statementOf(semi).rows.map(({ raw: _raw, ...r }) => r);
    const b = statementOf(csobDocument(rows)).rows.map(({ raw: _raw, ...r }) => r);
    expect(a).toEqual(b);
    expect(a.map((r) => [r.amount, r.currencyCode, r.operationAmount])).toEqual([[6_100_000, 840, 300_000], [-123_450, 203, -123_450]]);
  });

  it('leaves a Monobank CSV alone, and Monobank leaves ČSOB alone', () => {
    const url = new URL('../monobank/fixtures/conformance/card-uk.document.json', import.meta.url);
    const mono = JSON.parse(fs.readFileSync(url, 'utf8')) as StatementDocument;
    expect(csobAccountReader.detect(mono)).toBe(0);
    const doc = csobDocument([{ date: '01.10.2026', amount: '250', type: 'Debit card transaction' }]);
    for (const r of monobankReaders) expect(r.detect(doc)).toBe(0);
  });

  it('unsigned integer amounts take their direction from the type', () => {
    expect(one({ date: '01.10.2026', amount: '250', type: 'Debit card transaction', category: 'Groceries' }).amount).toBe(-25000);
    expect(one({ date: '01.10.2026', amount: '250', type: 'Incoming instant payment', category: 'Income' }).amount).toBe(25000);
    expect(one({ date: '01.10.2026', amount: '40', type: 'Card transaction - refund', category: 'Groceries' }).amount).toBe(4000);
    expect(one({ date: '01.10.2026', amount: '2000', type: 'Cash deposit through cash deposit ATM', category: 'Income' }).amount).toBe(200000);
    expect(one({ date: '01.10.2026', amount: '35', type: 'Foreign payment - fee', category: 'Bank transactions' }).amount).toBe(-3500);
    expect(one({ date: '01.10.2026', amount: '500', type: 'El. banking standing order 7', category: 'Outgoing unclassified' }).amount).toBe(-50000);
  });

  it('a sign wins over the type; a decimal comma or dot reads', () => {
    expect(one({ date: '01.10.2026', amount: '-452,30', type: 'Incoming payment' }).amount).toBe(-45230);
    expect(one({ date: '01.10.2026', amount: '1 234.5', type: 'Incoming payment' }).amount).toBe(123450);
    expect(one({ date: '01.10.2026', amount: '+12,05', type: 'Debit card transaction' }).amount).toBe(1205);
  });

  // Row numbers count the CSV's rows; the parser drops the empty line under the title.
  it('an unsigned amount of an unknown type refuses the file at that row', () => {
    const doc = csobDocument([
      { date: '02.10.2026', amount: '100', type: 'Debit card transaction' },
      { date: '01.10.2026', amount: '100', type: 'Something new' },
    ]);
    expect(csobAccountReader.read(doc)).toEqual({ ok: false, problem: 'bad-row', row: 4 });
  });

  it('two accounts or two currencies refuse the file', () => {
    const base: Row = { date: '01.10.2026', amount: '100', type: 'Debit card transaction' };
    expect(csobAccountReader.read(csobDocument([base, { ...base, account: '987654321/0300' }]))).toEqual({ ok: false, problem: 'bad-row', row: 4 });
    expect(csobAccountReader.read(csobDocument([base, { ...base, currency: 'EUR' }]))).toEqual({ ok: false, problem: 'bad-row', row: 4 });
  });

  it('dates at midnight in Prague, oldest first, closing balance from the newest row, trailing rows skipped', () => {
    const s = statementOf(
      csobDocument(
        [
          { date: '03.10.2026', amount: '100', type: 'Debit card transaction', balance: '9700' },
          { date: '02.10.2026', amount: '100', type: 'Debit card transaction', balance: '9800' },
          { date: '02.10.2026', amount: '100', type: 'Debit card transaction', balance: '9900' },
        ],
        { trailing: 3 },
      ),
    );
    expect(s.currencyCode).toBe(203);
    expect(s.account).toEqual({ iban: czIban('123456789', '0300'), cards: [], type: null });
    expect(s.closingBalance).toBe(970000);
    expect(s.rows.map((r) => r.balance)).toEqual([990000, 980000, 970000]);
    // 02.10.2026 00:00 in Prague (CEST, UTC+2) = 01.10.2026 22:00 UTC.
    expect(s.rows[0]!.time).toBe(Date.UTC(2026, 9, 1, 22) / 1000);
  });

  it('a foreign original amount is the operation amount; one in the account currency is not', () => {
    const abroad = one({ date: '01.10.2026', amount: '310', type: 'Debit card transaction', category: 'Vacation', original: '12,50 EUR', rate: '24,800' });
    expect(abroad).toMatchObject({ amount: -31000, currencyCode: 978, operationAmount: -1250 });
    const home = one({ date: '01.10.2026', amount: '310', type: 'Debit card transaction', original: '310,00 CZK' });
    expect(home).toMatchObject({ amount: -31000, currencyCode: 203, operationAmount: -31000 });
  });

  it('a Czech counter account becomes its IBAN; a foreign one keeps only its name', () => {
    const cz = one({ date: '01.10.2026', amount: '900', type: 'Outgoing payment', counterAccount: '19-1234567890', counterBank: '0800', counterName: 'Test Person' });
    expect(cz.counterIban).toBe(czIban('19-1234567890', '0800'));
    expect(cz.counterIban!.slice(4)).toBe('08000000191234567890');
    expect(cz.counterName).toBe('Test Person');
    expect(cz.description).toBe('Test Person');
    const foreign = one({ date: '01.10.2026', amount: '900', type: 'Incoming foreign payment', counterAccount: '12345678', counterBank: 'TESTDEFF', counterName: 'Test Sender' });
    expect(foreign.counterIban).toBeUndefined();
    expect(foreign.counterName).toBe('Test Sender');
  });

  it('the description is the note\'s place, else the counterparty, else the type', () => {
    expect(one({ date: '01.10.2026', amount: '99', type: 'Debit card transaction', note: 'Amount: 99,00 CZK, Place: TEST MARKET PRAHA' }).description).toBe('TEST MARKET PRAHA');
    expect(one({ date: '01.10.2026', amount: '99', type: 'Debit card transaction' }).description).toBe('Debit card transaction');
  });

  it('a card refund stores its type whatever the category, so the rules count it as a refund, not income', () => {
    expect(one({ date: '01.10.2026', amount: '343', type: 'Card transaction - refund', category: 'Income' }).bankCategory).toBe('Card transaction - refund');
    expect(one({ date: '01.10.2026', amount: '343', type: 'Card transaction - refund', category: 'Groceries' }).bankCategory).toBe('Card transaction - refund');
  });

  it('a transfer with a generic category stores its type; one with its own category keeps it', () => {
    expect(one({ date: '01.10.2026', amount: '500', type: 'Incoming payment', category: 'Income' }).bankCategory).toBe('Incoming payment');
    expect(one({ date: '01.10.2026', amount: '500', type: 'El. banking standing order (12)', category: '' }).bankCategory).toBe('El. banking standing order');
    expect(one({ date: '01.10.2026', amount: '500', type: 'Outgoing payment', category: 'TV, internet, phone' }).bankCategory).toBe('TV, internet, phone');
    expect(one({ date: '01.10.2026', amount: '500', type: 'Debit card transaction', category: 'Groceries' }).bankCategory).toBe('Groceries');
  });

  it('keeps only the columns it reads in raw', () => {
    const raw = JSON.parse(one({ date: '01.10.2026', amount: '99', type: 'Debit card transaction' }).raw) as Record<string, string>;
    expect(Object.keys(raw)).not.toContain('counterparty address');
    expect(Object.keys(raw).sort()).toEqual(
      ['amount', 'balance', 'category', 'counterAccount', 'counterBank', 'counterName', 'currency', 'date', 'id', 'note', 'original', 'type'].sort(),
    );
  });

  it('a header with no rows is empty', () => {
    expect(csobAccountReader.read(csobDocument([], { trailing: 2 }))).toEqual({ ok: false, problem: 'empty' });
  });
});
