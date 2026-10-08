// The CSV reader statement files go through. Invented data only.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseCsv } from '../src/csv.ts';

const fixture = (name: string) => readFileSync(new URL(`./providers/monobank/fixtures/${name}`, import.meta.url), 'utf8');

describe('parseCsv', () => {
  it('plain and quoted fields, a doubled quote, a comma inside quotes', () => {
    expect(parseCsv('a,"b c","d ""e"", f",\n1,2,3,4\n')).toEqual([
      ['a', 'b c', 'd "e", f', ''],
      ['1', '2', '3', '4'],
    ]);
  });

  it('a line break inside quotes stays in the field; CRLF ends a row; a trailing empty line is not a row', () => {
    expect(parseCsv('"Date of \r\ntransaction",x\r\n1,2\r\n\r\n')).toEqual([
      ['Date of \r\ntransaction', 'x'],
      ['1', '2'],
    ]);
  });

  it('a leading BOM is dropped; no final line break is fine', () => {
    expect(parseCsv('﻿a,b\n1,2')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });

  it('empty text → no rows', () => {
    expect(parseCsv('')).toEqual([]);
    expect(parseCsv('﻿')).toEqual([]);
  });

  it('an unclosed quote is an error, not a silent row', () => {
    expect(() => parseCsv('a,"b\n1,2')).toThrow(/quote/i);
  });

  it('the fixtures: the card statement has ten columns per row; the FOP header cells keep their line breaks', () => {
    const card = parseCsv(fixture('statement-card-uk.csv'));
    expect(card).toHaveLength(6);
    expect(new Set(card.map((r) => r.length))).toEqual(new Set([10]));
    expect(card[4]?.[1]).toBe('Кава "Тест", Київ');

    const fop = parseCsv(fixture('statement-fop.csv'));
    expect(fop[0]).toHaveLength(1);
    expect(fop[1]?.[0]).toMatch(/^Date of ?\ntransaction$/);
    expect(fop[1]).toHaveLength(14);
  });
});
