// A-Bank's card statement readers (src/providers/abank/statement.ts): the workbook and the PDF of one fictional
// statement read alike. Invented data only.
import { describe, expect, it } from 'vitest';
import { abankCardPdfReader, abankCardXlsxReader } from '../../../src/providers/abank/statement.ts';
import { pickReader } from '../../../src/providers/statements.ts';
import type { Cell, ParsedStatement, StatementDocument, StatementReader } from '../../../src/providers/types.ts';
import { CARD_A, CARD_B, IBAN, OPS, pdf, workbook, type Op } from './documents.ts';

const kyiv = (iso: string) => Math.floor(Date.parse(`${iso}+02:00`) / 1000);

function one(reader: StatementReader, doc: StatementDocument): ParsedStatement {
  const r = reader.read(doc);
  if (!r.ok) throw new Error(`${r.problem} ${r.row ?? ''}`);
  expect(r.statements).toHaveLength(1);
  return r.statements[0]!;
}

/** What both formats must agree on: every field but the raw payload (its keys are each file's own headers). */
const plain = (st: ParsedStatement) => ({ ...st, rows: st.rows.map(({ raw: _raw, ...row }) => row) });

describe.each([
  ['the workbook', abankCardXlsxReader, () => workbook()],
  ['the PDF', abankCardPdfReader, () => pdf()],
])('%s', (_name, reader, doc) => {
  it('is picked by its content, sure of it', () => {
    expect(reader.detect(doc())).toBe(2);
    expect(pickReader(doc())).toEqual({ ok: true, reader });
  });

  it('one account: the IBAN, both cards, the currency, the limit, the closing balance', () => {
    const st = one(reader, doc());
    expect(st.kind).toBe('card');
    expect(st.currencyCode).toBe(980);
    expect(st.account).toEqual({ iban: IBAN, cards: [CARD_A, CARD_B], type: null });
    expect(st.creditLimit).toBe(1000000);
    expect(st.closingBalance).toBe(1280070);
    expect(st.rows).toHaveLength(OPS.length);
  });

  it('rows oldest first, equal minutes in the file’s own order', () => {
    const st = one(reader, doc());
    expect(st.rows.every((r, i) => i === 0 || st.rows[i - 1]!.time <= r.time)).toBe(true);
    expect(st.rows[0]).toMatchObject({ time: kyiv('2026-01-03T09:00:00'), amount: 500000, mcc: 4829, description: 'MONO*VYHADANYI VIDPRAVNYK' });
    const cashback = st.rows.filter((r) => r.description === 'Зарахування кешбеку на картку');
    expect(cashback.map((r) => r.amount)).toEqual([3250, 1000]);
  });

  it('a purchase in dollars, a withdrawal with its fee, cashback, a row without an MCC', () => {
    const rows = one(reader, doc()).rows;
    const by = (d: string) => rows.find((r) => r.description === d)!;
    expect(by('Вигаданий сервіс')).toMatchObject({ amount: -4560, operationAmount: -100, currencyCode: 840, cashbackAmount: 46, mcc: 5399 });
    expect(by('Зняття готівки')).toMatchObject({ amount: -53000, operationAmount: -50000, currencyCode: 980, commissionRate: 3000, mcc: 6010 });
    expect(by('Зняття готівки').cashbackAmount).toBeUndefined();
    expect(by('Скасування. Вигаданий магазин')).toMatchObject({ amount: 200000, cashbackAmount: -2000 });
    const noCode = by('Вигадана аптека, місто');
    expect(noCode.mcc).toBeUndefined();
    expect(noCode).toMatchObject({ amount: 8420, cashbackAmount: -84, balance: 1380070 });
    expect(by('Вигадана Особа').commissionRate).toBeUndefined();
  });

  it('reads twice the same', () => {
    expect(reader.read(doc())).toEqual(reader.read(doc()));
  });
});

describe('both formats', () => {
  it('give the same statement', () => {
    expect(plain(one(abankCardPdfReader, pdf()))).toEqual(plain(one(abankCardXlsxReader, workbook())));
  });

  it('each reader leaves the other format alone', () => {
    expect(abankCardXlsxReader.detect(pdf())).toBe(0);
    expect(abankCardPdfReader.detect(workbook())).toBe(0);
  });
});

describe('the workbook', () => {
  it('numbers stored as numbers and an Excel serial date read like their texts', () => {
    const n = (v: string): Cell => ({ t: 'n', v });
    const s = (v: string): Cell => (v === '' ? null : { t: 's', v });
    const plainNumber = (v: string) => v.replace(/ /g, '').replace(',', '.');
    const typed = (op: Op): Cell[] => op.map((v, i) => (i === 0 ? s(v) : [4, 5, 10].includes(i) ? n(plainNumber(v)) : s(v)));
    const first = OPS.at(-1)!;
    // 03.01.2026 09:00 Kyiv as an Excel serial.
    const doc = workbook(OPS, { cells: (op) => (op === first ? [n('46025.375'), ...typed(op).slice(1)] : typed(op)) });
    expect(plain(one(abankCardXlsxReader, doc))).toEqual(plain(one(abankCardXlsxReader, workbook())));
  });

  it('the headers alone: picked less surely, no IBAN or limit', () => {
    const doc = workbook(OPS, { heading: false });
    expect(abankCardXlsxReader.detect(doc)).toBe(1);
    const st = one(abankCardXlsxReader, doc);
    expect(st.account.iban).toBeNull();
    expect(st.creditLimit).toBeNull();
  });

  it('a row that does not read refuses the file with its sheet row', () => {
    const bad = OPS.map((op, i) => (i === 2 ? ([...op.slice(0, 4), 'abc', ...op.slice(5)] as Op) : op));
    // Six heading rows and an empty one, then the header: the third operation is sheet row 11.
    expect(abankCardXlsxReader.read(workbook(bad))).toEqual({ ok: false, problem: 'bad-row', row: 11 });
  });

  it('a credit limit in another currency is a bad row; no operations → empty', () => {
    const doc = workbook();
    if (doc.format !== 'sheets') throw new Error();
    doc.sheets[0]!.rows[4]![0] = { t: 's', v: 'Кредитний ліміт (станом на 20.01.2026): 100,00 USD' };
    expect(abankCardXlsxReader.read(doc)).toEqual({ ok: false, problem: 'bad-row' });
    expect(abankCardXlsxReader.read(workbook([]))).toEqual({ ok: false, problem: 'empty' });
  });

  it('another spreadsheet is not claimed', () => {
    const doc: StatementDocument = { format: 'sheets', sheets: [{ name: 'S', rows: [[{ t: 's', v: 'Дата' }, { t: 's', v: 'Сума' }]] }] };
    expect(abankCardXlsxReader.detect(doc)).toBe(0);
  });
});

describe('the PDF', () => {
  it('a table over three pages under a repeated header reads every operation once', () => {
    expect(plain(one(abankCardPdfReader, pdf(OPS, { perPage: 4 })))).toEqual(plain(one(abankCardPdfReader, pdf())));
  });

  it('without the client block: no IBAN, the cards still name the account; without the bank’s marks: less sure', () => {
    const st = one(abankCardPdfReader, pdf(OPS, { heading: false }));
    expect(st.account).toEqual({ iban: null, cards: [CARD_A, CARD_B], type: null });
    expect(st.creditLimit).toBeNull();
    expect(abankCardPdfReader.detect(pdf(OPS, { heading: false, mark: false }))).toBe(1);
  });

  it('a row that does not read refuses the file with its position', () => {
    const bad = OPS.map((op, i) => (i === 6 ? ([...op.slice(0, 6), 'XXX', ...op.slice(7)] as Op) : op));
    expect(abankCardPdfReader.read(pdf(bad))).toEqual({ ok: false, problem: 'bad-row', row: 7 });
  });
});
