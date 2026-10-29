// The helpers every statement reader shares (src/providers/statement-kit.ts). Fictional values only.
import { describe, expect, it } from 'vitest';
import { columnsByHeader, gridOf, isEmptyRow, lineSegments, localAmount, normHeader, pdfLines, pdfTable, wallTime, type PdfItem } from '../../src/providers/statement-kit.ts';
import type { StatementDocument } from '../../src/providers/types.ts';

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

  it('a decomposed «ї» reads as the composed one', () => {
    expect(normHeader('Деталі операці\u0456\u0308')).toBe('деталі операції');
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

describe('localAmount', () => {
  it('thousands with any space and a decimal comma, or a stored number', () => {
    expect(localAmount('-1 234,56')).toBe('-1234.56');
    expect(localAmount('1\u00a0234\u00a0567,00')).toBe('1234567.00');
    expect(localAmount('1\u202f000,5')).toBe('1000.5');
    expect(localAmount('12,30')).toBe('12.30');
    expect(localAmount('-1234.56')).toBe('-1234.56');
    expect(localAmount('7')).toBe('7');
  });

  it('anything else is not an amount', () => {
    for (const s of ['-', '', '1,2,3', '12 34,00', 'abc', '1.234,56']) expect(localAmount(s), s).toBeNull();
  });
});

const item = (x: number, y: number, text: string, w = text.length * 4): PdfItem => ({ x, y, w, h: 7, text });

describe('pdfLines and lineSegments', () => {
  it('items on one baseline are a line, left to right; lines top down', () => {
    const lines = pdfLines([item(50, 20.5, 'b'), item(10, 20, 'a'), item(10, 40, 'c')]);
    expect(lines.map((l) => l.items.map((i) => i.text))).toEqual([['a', 'b'], ['c']]);
  });

  it('close items join, a wide gap splits', () => {
    const [line] = pdfLines([item(10, 20, 'Ліміт:', 24), item(38, 20, '100,00 UAH', 40), item(300, 20, 'Баланс:', 28)]);
    expect(lineSegments(line!)).toEqual(['Ліміт: 100,00 UAH', 'Баланс:']);
  });
});

describe('pdfTable', () => {
  const spec = [
    { field: 'time', re: /^дата і час$/ },
    { field: 'details', re: /^деталі$/ },
    { field: 'amount', re: /^сума \((\w{3})\)$/ },
  ] as const;
  const AMOUNT_RE = /^-?\d[\d ]*,\d{2}$/;
  // Column spans: 40–80, 140–180, 300–340. Amounts right-aligned, details centred, like a real bank's layout.
  const header = (y: number) => [item(40, y, 'Дата і', 40), item(140, y, 'Деталі', 40), item(300, y, 'Сума', 40), item(40, y + 6, 'час', 40), item(300, y + 6, '(UAH)', 40)];
  const row = (y: number, date: string, time: string, details: string, amount: string) => [
    item(40, y - 5, date, 40),
    item(40, y + 5, time, 20),
    item(160 - details.length * 2, y, details),
    item(340 - amount.length * 4, y, amount),
  ];
  const page = (items: PdfItem[]) => ({ width: 600, height: 400, items });

  it('the heading, the captures, and each row with its date over its time; page headers and footers left out', () => {
    const doc: StatementDocument = {
      format: 'pdf',
      pages: [
        page([item(40, 10, 'Вигаданий банк'), item(40, 30, 'Ліміт:', 24), item(68, 30, '1 000,00 UAH', 48), ...header(60), ...row(90, '02.01.2026', '10:00', 'Кав’ярня', '-50,00'), ...row(116, '01.01.2026', '09:00', 'Магазин', '-1 200,00'), item(40, 380, 'Сторінка 1 з 2')]),
        page([item(40, 10, 'Вигаданий банк'), ...header(60), ...row(90, '31.12.2025', '23:59', 'Аптека', '-7,10'), item(40, 380, 'Сторінка 2 з 2')]),
      ],
    };
    const t = pdfTable(doc, spec, 'amount', AMOUNT_RE);
    expect(t?.header.amount[1]).toBe('uah');
    expect(t?.names).toEqual({ time: 'Дата і час', details: 'Деталі', amount: 'Сума (UAH)' });
    expect(t?.heading).toEqual(['Вигаданий банк', 'Ліміт: 1 000,00 UAH']);
    expect(t?.rows).toEqual([
      { time: '02.01.2026 10:00', details: 'Кав’ярня', amount: '-50,00' },
      { time: '01.01.2026 09:00', details: 'Магазин', amount: '-1 200,00' },
      { time: '31.12.2025 23:59', details: 'Аптека', amount: '-7,10' },
    ]);
  });

  it('a wrapped description is one cell; a page without its own header continues the table', () => {
    const wrapped = [item(40, 85, '03.01.2026', 40), item(40, 95, '08:00', 20), item(140, 85, 'Довгий опис'), item(150, 95, 'магазину'), item(316, 90, '-3,00', 20)];
    const doc: StatementDocument = { format: 'pdf', pages: [page([...header(60), ...wrapped, ...row(116, '02.01.2026', '07:00', 'Кіоск', '-1,00')]), page(row(40, '01.01.2026', '06:00', 'Таксі', '-2,00'))] };
    expect(pdfTable(doc, spec, 'amount', AMOUNT_RE)?.rows.map((r) => [r.time, r.details])).toEqual([
      ['03.01.2026 08:00', 'Довгий опис магазину'],
      ['02.01.2026 07:00', 'Кіоск'],
      ['01.01.2026 06:00', 'Таксі'],
    ]);
  });

  it('cell lines run parallel to the rows, one entry per line', () => {
    const wrapped = [item(40, 85, '03.01.2026', 40), item(40, 95, '08:00', 20), item(140, 85, 'Довгий опис'), item(150, 95, 'магазину'), item(316, 90, '-3,00', 20)];
    const t = pdfTable({ format: 'pdf', pages: [page([...header(60), ...wrapped])] }, spec, 'amount', AMOUNT_RE);
    expect(t?.lines).toEqual([{ time: ['03.01.2026', '08:00'], details: ['Довгий опис', 'магазину'], amount: ['-3,00'] }]);
  });

  describe('rows below their anchor, and where the table ends', () => {
    const DATE_RE = /^\d{2}\.\d{2}\.\d{4}$/;
    // A row's first line holds the date and the amount; its details follow on the lines under it.
    const below = (y: number, date: string, amount: string, ...details: string[]) => [
      item(40, y, date, 40),
      item(340 - amount.length * 4, y, amount),
      ...details.map((d, i) => item(140, y + 11 * (i + 1), d)),
    ];
    const options = { rowBand: 'below', pageEndRe: /^[A-Z]\d_[A-Z]\d_\d+$|^Вигаданий банк, контакти/, tableEndRe: /^Не виконані:$/ } as const;
    const footer = (y: number) => [item(10, y, 'A1_B2_0001', 40), item(140, y + 5, 'Вигаданий банк, контакти')];

    it('each row takes the lines under it down to the next anchor; the footer stays out', () => {
      const doc: StatementDocument = {
        format: 'pdf',
        pages: [
          page([...header(60), ...below(90, '01.01.2026', '-1,00', 'Картка', 'Кав’ярня', 'Гаманець'), ...below(134, '02.01.2026', '-2,00', 'Картка', 'Магазин'), ...footer(370)]),
          page([...header(60), ...below(90, '03.01.2026', '5,00', 'Від банку'), ...footer(370)]),
        ],
      };
      const t = pdfTable(doc, spec, 'time', DATE_RE, options);
      expect(t?.rows.map((r) => [r.time, r.amount])).toEqual([
        ['01.01.2026', '-1,00'],
        ['02.01.2026', '-2,00'],
        ['03.01.2026', '5,00'],
      ]);
      expect(t?.lines.map((l) => l.details)).toEqual([['Картка', 'Кав’ярня', 'Гаманець'], ['Картка', 'Магазин'], ['Від банку']]);
    });

    it('a section after the operations ends the table, with its own dated rows and later pages', () => {
      const doc: StatementDocument = {
        format: 'pdf',
        pages: [
          page([...header(60), ...below(90, '01.01.2026', '-1,00', 'Картка', 'Магазин'), item(40, 140, 'Не виконані:', 60), ...below(152, '02.01.2026', '-9,00', 'Переказ')]),
          page([...header(60), ...below(90, '03.01.2026', '-3,00', 'Ще одна')]),
        ],
      };
      const t = pdfTable(doc, spec, 'time', DATE_RE, options);
      expect(t?.rows.map((r) => r.time)).toEqual(['01.01.2026']);
      expect(t?.lines[0]?.details).toEqual(['Картка', 'Магазин']);
    });

    it('without the options a row still takes the lines around its anchor', () => {
      const doc: StatementDocument = { format: 'pdf', pages: [page([...header(60), ...below(90, '01.01.2026', '-1,00', 'Картка'), ...below(134, '02.01.2026', '-2,00', 'Магазин')])] };
      expect(pdfTable(doc, spec, 'time', DATE_RE)?.lines.map((l) => l.details)).toEqual([['Картка'], ['Магазин']]);
    });
  });

  it('no header on any page, or not a PDF → null', () => {
    expect(pdfTable({ format: 'pdf', pages: [page(row(90, '01.01.2026', '06:00', 'Таксі', '-2,00'))] }, spec, 'amount', AMOUNT_RE)).toBeNull();
    expect(pdfTable({ format: 'text', text: '' }, spec, 'amount', AMOUNT_RE)).toBeNull();
  });
});
