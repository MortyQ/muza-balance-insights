// Monobank statement files: the Ukrainian card statement is read; the English one and the FOP one are refused with
// their own codes. Invented data only (fixtures/).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { monobankStatement, toMinor } from '../../../src/providers/monobank/statement.ts';
import type { ParsedStatement } from '../../../src/providers/types.ts';

const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');
const kyiv = (iso: string) => Math.floor(Date.parse(`${iso}+03:00`) / 1000);

function parsed(text: string): ParsedStatement {
  const r = monobankStatement.parse(text);
  if (!r.ok) throw new Error(`not parsed: ${r.problem}`);
  return r.statement;
}

const HEADER =
  '"Дата i час операції","Деталі операції",MCC,"Сума в валюті картки (UAH)","Сума в валюті операції",Валюта,Курс,"Сума комісій (UAH)","Сума кешбеку (UAH)","Залишок після операції"';

describe('toMinor', () => {
  it.each([
    ['530.0', 980, 53000],
    ['-845.5', 980, -84550],
    ['0.95', 980, 95],
    ['188234.26', 980, 18823426],
    ['-0.0', 980, 0],
    ['1000.0', 392, 1000],
    ['12', 980, 1200],
  ])('%s (%i) → %i', (s, code, minor) => {
    expect(toMinor(s, code)).toBe(minor);
  });

  it.each([['12.345'], ['1 000.00'], ['1,5'], [''], ['—'], ['1e3'], ['1000.5']])('%s does not read', (s) => {
    expect(toMinor(s, s === '1000.5' ? 392 : 980)).toBeNull();
  });
});

describe('the Ukrainian card statement', () => {
  it('reads every row, oldest first, with the exact minor units and Kyiv times', () => {
    const st = parsed(fixture('statement-card-uk.csv'));
    expect(st.kind).toBe('card');
    expect(st.currencyCode).toBe(980);
    expect(st.closingBalance).toBe(961770);
    expect(st.rows.map((r) => r.time)).toEqual(
      ['2026-10-03T09:05:11', '2026-10-04T18:40:03', '2026-10-05T21:17:56', '2026-10-06T10:02:37', '2026-10-07T12:15:42'].map(kyiv),
    );
    const [income, coffee, steam, transfer, market] = st.rows;
    expect(income).toMatchObject({ description: 'Від: Тест Тестенко', mcc: 4829, amount: 500000, operationAmount: 500000, currencyCode: 980, hold: false, balance: 1200000 });
    expect(income).not.toHaveProperty('commissionRate');
    expect(income).not.toHaveProperty('cashbackAmount');
    expect(coffee).toMatchObject({ description: 'Кава "Тест", Київ', mcc: 5814, amount: -9500, cashbackAmount: 95 });
    expect(steam).toMatchObject({ amount: -43680, operationAmount: -1040, currencyCode: 840, mcc: 5816 });
    expect(transfer).toMatchObject({ amount: -100500, operationAmount: -100000, commissionRate: 500 });
    expect(market).toMatchObject({ amount: -84550, cashbackAmount: 846, balance: 961770 });
  });

  it("keeps the file's row as raw JSON, column name → cell", () => {
    const raw = JSON.parse(parsed(fixture('statement-card-uk.csv')).rows[0]?.raw ?? '{}') as Record<string, string>;
    expect(raw['Деталі операції']).toBe('Від: Тест Тестенко');
    expect(raw['Курс']).toBe('—');
  });

  it('the currency of the card comes from the column names; columns may come in any order', () => {
    const header = HEADER.replaceAll('(UAH)', '(USD)').replace('MCC,', '').replace('"Деталі операції",', '"Деталі операції",MCC,');
    const st = parsed(`${header}\n"01.10.2026 10:00:00","Test",5411,-10.5,-10.5,USD,—,—,—,100.0\n`);
    expect(st.currencyCode).toBe(840);
    expect(st.rows[0]).toMatchObject({ amount: -1050, currencyCode: 840, balance: 10000 });
  });

  it('two rows in one second keep their order from the file (newest first there)', () => {
    const st = parsed(`${HEADER}\n"01.10.2026 10:00:00","B",5411,-2.0,-2.0,UAH,—,—,—,7.0\n"01.10.2026 10:00:00","A",5411,-1.0,-1.0,UAH,—,—,—,9.0\n`);
    expect(st.rows.map((r) => r.description)).toEqual(['A', 'B']);
    expect(st.closingBalance).toBe(700);
  });
});

describe('refused files', () => {
  it('the English statement: its service texts are translated', () => {
    expect(monobankStatement.parse(fixture('statement-card.csv'))).toEqual({ ok: false, problem: 'english' });
  });

  it('the FOP statement: not supported yet', () => {
    expect(monobankStatement.parse(fixture('statement-fop.csv'))).toEqual({ ok: false, problem: 'unsupported-kind' });
  });

  it('a header without rows, an empty file', () => {
    expect(monobankStatement.parse(`${HEADER}\n`)).toEqual({ ok: false, problem: 'empty' });
    expect(monobankStatement.parse('')).toEqual({ ok: false, problem: 'empty' });
  });

  it('anything else is an unknown format', () => {
    expect(monobankStatement.parse('a,b,c\n1,2,3\n')).toEqual({ ok: false, problem: 'unknown-format' });
    expect(monobankStatement.parse(HEADER.replace('MCC,', ''))).toEqual({ ok: false, problem: 'unknown-format' });
    expect(monobankStatement.parse('"unclosed\n')).toEqual({ ok: false, problem: 'unknown-format' });
  });

  it('a row that does not read names its line; nothing is guessed', () => {
    const ok = '"01.10.2026 10:00:00","A",5411,-1.0,-1.0,UAH,—,—,—,9.0';
    for (const bad of [
      ok.replace('-1.0,-1.0', '-1.005,-1.0'),
      ok.replace('01.10.2026', '31.02.2026'),
      ok.replace('5411', '—'),
      ok.replace(',UAH,', ',XYZ,'),
      ok.replace('9.0', 'n/a'),
    ]) {
      expect(monobankStatement.parse(`${HEADER}\n${ok}\n${bad}\n`)).toEqual({ ok: false, problem: 'bad-row', row: 3 });
    }
  });
});
