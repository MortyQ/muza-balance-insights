// Slovenská sporiteľňa's account statement reader (src/providers/slsp/statement.ts) on a fictional PDF
// (./documents.ts): rows across their lines, card moments, foreign amounts, fees, transfers, the section of operations
// not carried out, and the file's check against itself. Invented data only.
import { describe, expect, it } from 'vitest';
import { slspAccountPdfReader as reader } from '../../../src/providers/slsp/statement.ts';
import { abankCardPdfReader } from '../../../src/providers/abank/statement.ts';
import { pdf as abankPdf } from '../abank/documents.ts';
import { CARD, IBAN, OPS, statement } from './documents.ts';

/** Unix seconds of a Bratislava wall-clock moment in winter (UTC+1). */
const cet = (d: number, h = 0, mi = 0, s = 0) => Date.UTC(2026, 0, d, h - 1, mi, s) / 1000;

function read(doc = statement()) {
  const r = reader.read(doc);
  if (!r.ok) throw new Error(`not read: ${r.problem} ${r.row ?? ''}`);
  expect(r.statements).toHaveLength(1);
  return r.statements[0]!;
}

describe('detect', () => {
  it('the title and the bank code with the table → 2; the table alone → 1; another bank → 0', () => {
    expect(reader.detect(statement())).toBe(2);
    expect(reader.detect(statement({ heading: false }))).toBe(1);
    expect(reader.detect(abankPdf())).toBe(0);
    expect(abankCardPdfReader.detect(statement())).toBe(0);
    expect(reader.detect({ format: 'text', text: 'Výpis z Účtu' })).toBe(0);
  });
});

describe('the account', () => {
  it('one statement: the IBAN and currency of the heading, its card, the heading closing balance', () => {
    const s = read();
    expect(s.kind).toBe('card');
    expect(s.currencyCode).toBe(978);
    expect(s.account).toEqual({ iban: IBAN, cards: [CARD], type: null });
    expect(s.closingBalance).toBe(229240);
    expect(s.rows).toHaveLength(OPS.length);
  });

  it('pages: the header repeated on each, the footers and the closing note left out', () => {
    const one = read(statement({ perPage: 20 }));
    const three = read(statement({ perPage: 3 }));
    expect(three.rows).toEqual(one.rows);
  });

  it('no heading → unknown format', () => {
    expect(reader.read(statement({ heading: false }))).toEqual({ ok: false, problem: 'unknown-format' });
  });
});

describe('rows', () => {
  const rows = read().rows;
  const byType = (type: string) => rows.filter((r) => r.bankCategory === type);

  it('oldest first; a card operation at its own moment, others at the booking date in Bratislava', () => {
    expect(rows.map((r) => r.time)).toEqual([cet(1, 18, 30, 5), cet(2), cet(4, 10, 15), cet(6, 9), cet(7, 12), cet(8), cet(8), cet(10, 7, 45, 10), cet(11)]);
  });

  it('a card payment: the merchant without its moment, the wallet line or the card', () => {
    const [first] = rows;
    expect(first).toMatchObject({ amount: -1240, currencyCode: 978, operationAmount: -1240, description: 'BILLA 113-MESTO', bankCategory: 'Platba kartou', balance: 98760, hold: false });
    expect(first?.commissionRate).toBeUndefined();
  });

  it('a wrapped moment and a two-line wallet; the hryvnia amount is the operation amount', () => {
    expect(rows[2]).toMatchObject({ amount: -2500, currencyCode: 980, operationAmount: -123450, description: 'VYMYSLENY OBCHOD-MESTO' });
  });

  it('a withdrawal with a fee: the amount includes it, the fee is the commission', () => {
    expect(byType('Výber kartou')[0]).toMatchObject({ amount: -10200, operationAmount: -10000, commissionRate: 200, balance: 111060 });
  });

  it('a deposit with its moment on the next line; a refund at midnight', () => {
    expect(byType('Vklad cez ATM')[0]).toMatchObject({ amount: 130000, description: 'VYMYSLENY ATM-MESTO', time: cet(7, 12) });
    expect(byType('Návrat tovaru')[0]).toMatchObject({ amount: 500, description: 'LIDL DAKUJE 9-MESTO', time: cet(8) });
  });

  it('transfers: the IBAN without spaces or BIC, the name as counterparty and description', () => {
    expect(byType('Prijatá Okamžitá platba')[0]).toMatchObject({ amount: 25000, counterIban: 'SK9911000000000000000002', counterName: 'VYMYSLENA OSOBA', description: 'VYMYSLENA OSOBA' });
    expect(byType('SEPA platba (elektronicky)')[0]).toMatchObject({ amount: -8000, counterIban: 'SK9902000000000000000003', counterName: 'VYMYSLENA FIRMA' });
    expect(byType('Okamžitá platba (elektronicky)')[0]).toMatchObject({ amount: -4000, counterIban: 'CZ9908000000000000000004', time: cet(11) });
  });

  it('no row has an MCC; the raw keeps the cells and the description lines', () => {
    expect(rows.every((r) => r.mcc === undefined)).toBe(true);
    expect(JSON.parse(rows[0]!.raw).description).toEqual(['Platba kartou', `Č. k. ${CARD}`, 'BILLA 113-MESTO 01. 01. 2026 18:30:05', 'Transakcia prostredníctvom GooglePay']);
  });
});

describe('the section of operations not carried out', () => {
  it('is left out, and its lines join no row', () => {
    const s = read(statement({ pending: true }));
    expect(s.rows).toEqual(read().rows);
  });
});

describe('the file against itself', () => {
  it('a printed balance that does not follow → bad-row at that operation', () => {
    expect(reader.read(statement({ breakBalanceAt: 4 }))).toEqual({ ok: false, problem: 'bad-row', row: 5 });
  });

  it('totals that do not add up → bad-row at the last operation', () => {
    for (const totals of [{ deposits: '1 555,01' }, { withdrawals: '- 262,59' }, { closing: '2 292,41' }]) {
      expect(reader.read(statement({ totals }))).toEqual({ ok: false, problem: 'bad-row', row: OPS.length });
    }
  });

  it('an amount that does not read → bad-row at its operation', () => {
    const doc = statement();
    if (doc.format !== 'pdf') throw new Error('not a PDF');
    for (const item of doc.pages[0]!.items) if (item.text === '250,00') item.text = '250,0x';
    expect(reader.read(doc)).toEqual({ ok: false, problem: 'bad-row', row: 2 });
  });
});
