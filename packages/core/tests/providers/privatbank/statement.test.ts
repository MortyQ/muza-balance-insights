// The Privat24 card statement reader (src/providers/privatbank/statement.ts). Fictional data only (./sheet.ts).
import { describe, expect, it } from 'vitest';
import { privatbankCardReader as reader } from '../../../src/providers/privatbank/statement.ts';
import type { Cell, StatementDocument } from '../../../src/providers/types.ts';
import { CARD_A, CARD_B, HEADER, OPS, op, sheet, type Op } from './sheet.ts';

const ok = (doc: StatementDocument) => {
  const r = reader.read(doc);
  if (!r.ok) throw new Error(`not read: ${r.problem}`);
  return r.statements;
};
const first: Op = OPS[6]!;

describe('detect', () => {
  it('the title and the headers → 2; the headers alone (a re-saved file) → 1', () => {
    expect(reader.detect(sheet([op(first)]))).toBe(2);
    expect(reader.detect(sheet([op(first)], { title: false }))).toBe(1);
  });

  it('other sheets, CSV text and PDF are not its own', () => {
    const other: StatementDocument = { format: 'sheets', sheets: [{ name: 'S', rows: [HEADER.slice(1).map((v) => ({ t: 's', v }) as Cell)] }] };
    expect(reader.detect(other)).toBe(0);
    expect(reader.detect({ format: 'sheets', sheets: [] })).toBe(0);
    expect(reader.detect({ format: 'text', text: HEADER.join(',') })).toBe(0);
    expect(reader.detect({ format: 'pdf', pages: [] })).toBe(0);
  });
});

describe('read', () => {
  it('one statement per card, oldest first, the closing balance of each card', () => {
    const [a, b] = ok(sheet(OPS.map(op)));
    expect(a?.account).toEqual({ iban: null, cards: [CARD_A], type: null });
    expect(b?.account).toEqual({ iban: null, cards: [CARD_B], type: null });
    expect(a?.rows.map((r) => r.time)).toEqual([...(a?.rows.map((r) => r.time) ?? [])].sort((x, y) => x - y));
    expect(a?.closingBalance).toBe(145000);
    expect(b?.closingBalance).toBe(30000);
    expect((a?.rows.length ?? 0) + (b?.rows.length ?? 0)).toBe(OPS.length);
  });

  it('a purchase in euros: the card amount, the euro amount and currency, no MCC, the bank category', () => {
    const [a] = ok(sheet([op(OPS[2]!)]));
    const { raw: _raw, ...row } = a!.rows[0]!;
    expect(row).toEqual({
      time: Date.UTC(2026, 0, 15, 7, 15) / 1000,
      amount: -43050,
      currencyCode: 978,
      hold: false,
      operationAmount: -1000,
      bankCategory: 'Інтернет-магазини',
      description: 'Вигаданий магазин',
      balance: 56000,
    });
  });

  it('a fee on top of a debit is its commission; a withheld fee on a credit is not', () => {
    const [a] = ok(sheet([op(OPS[0]!), op(OPS[1]!)]));
    const [credit, debit] = a!.rows;
    expect(debit).toMatchObject({ amount: -10500, operationAmount: -10000, commissionRate: 500 });
    expect(credit).toMatchObject({ amount: 99500, operationAmount: 100000 });
    expect(credit).not.toHaveProperty('commissionRate');
  });

  it('trailing empty rows are skipped; no operation at all → empty', () => {
    expect(ok(sheet([op(first)], { trailingEmpty: 50 }))[0]?.rows).toHaveLength(1);
    expect(reader.read(sheet([], { trailingEmpty: 5 }))).toEqual({ ok: false, problem: 'empty' });
  });

  it('an Excel serial date reads as the same Kyiv moment', () => {
    const row = op(first);
    row[0] = { t: 'n', v: '46037.5' };
    expect(ok(sheet([row]))[0]?.rows[0]?.time).toBe(Date.UTC(2026, 0, 15, 10) / 1000);
  });

  it('a bad date, a bad amount, a balance in another currency, a card changing currency → bad-row with its sheet row', () => {
    const bad = (patch: (r: Cell[]) => void, extra: Cell[][] = []) => {
      const r = op(first);
      patch(r);
      return reader.read(sheet([...extra, r]));
    };
    expect(bad((r) => (r[0] = { t: 's', v: '31.02.2026 10:00:00' }))).toEqual({ ok: false, problem: 'bad-row', row: 3 });
    expect(bad((r) => (r[4] = { t: 's', v: 'багато' }))).toEqual({ ok: false, problem: 'bad-row', row: 3 });
    expect(bad((r) => (r[9] = { t: 's', v: 'USD' }))).toEqual({ ok: false, problem: 'bad-row', row: 3 });
    expect(bad((r) => (r[5] = { t: 's', v: 'USD' }), [op(first)])).toEqual({ ok: false, problem: 'bad-row', row: 4 });
  });

  it('a file without the title reads the same', () => {
    expect(ok(sheet(OPS.map(op), { title: false }))).toEqual(ok(sheet(OPS.map(op))));
  });
});
