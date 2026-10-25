// The helpers every statement reader shares (src/providers/statement-kit.ts). Fictional values only.
import { describe, expect, it } from 'vitest';
import { columnsByHeader, gridOf, isEmptyRow, normHeader, wallTime } from '../../src/providers/statement-kit.ts';

describe('gridOf', () => {
  it('a CSV text and the first sheet become cell texts; a PDF or no sheet does not', () => {
    expect(gridOf({ format: 'text', text: 'a,b\n1,2' })).toEqual([['a', 'b'], ['1', '2']]);
    expect(gridOf({ format: 'sheets', sheets: [{ name: 'S', rows: [[{ t: 's', v: 'x' }, null, { t: 'n', v: '1.5' }]] }] })).toEqual([['x', '', '1.5']]);
    expect(gridOf({ format: 'sheets', sheets: [] })).toBeNull();
    expect(gridOf({ format: 'pdf', pages: [] })).toBeNull();
  });
});

describe('columnsByHeader', () => {
  const spec = [
    { field: 'time', re: /^дата$/ },
    { field: 'amount', re: /^сума \(([a-z]{3})\)$/ },
  ] as const;

  it('finds each column by its normalised name, with its captures', () => {
    const found = columnsByHeader(['  Сума   (UAH) ', 'Дата'], spec);
    expect(found?.time.index).toBe(1);
    expect(found?.amount.index).toBe(0);
    expect(found?.amount.match[1]).toBe('uah');
  });

  it('a missing or a doubled column → null', () => {
    expect(columnsByHeader(['Дата'], spec)).toBeNull();
    expect(columnsByHeader(['Дата', 'Дата', 'Сума (UAH)'], spec)).toBeNull();
  });

  it('the Latin «i» typed as the word «і»', () => {
    expect(normHeader('Дата i час')).toBe('дата і час');
  });
});

describe('wallTime', () => {
  it('Kyiv wall clock, with or without seconds', () => {
    expect(wallTime('15.01.2026 10:20:30')).toBe(Date.UTC(2026, 0, 15, 8, 20, 30) / 1000);
    expect(wallTime('15.07.2026 10:20')).toBe(Date.UTC(2026, 6, 15, 7, 20, 0) / 1000);
  });

  it('an Excel serial in the same zone', () => {
    expect(wallTime('46037.5')).toBe(Date.UTC(2026, 0, 15, 10, 0, 0) / 1000);
  });

  it('not a real moment → null', () => {
    expect(wallTime('31.02.2026 10:00:00')).toBeNull();
    expect(wallTime('15.01.2026 25:00')).toBeNull();
    expect(wallTime('вчора')).toBeNull();
  });
});

it('isEmptyRow', () => {
  expect(isEmptyRow(['', '  '])).toBe(true);
  expect(isEmptyRow(['', 'x'])).toBe(false);
});
