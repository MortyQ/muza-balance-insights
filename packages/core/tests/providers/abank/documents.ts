// A fictional A-Bank card statement as the desktop decodes it: a workbook's first sheet, or a PDF's text items placed
// as the bank's layout places them (A4 landscape; dates over times, details centred, amounts right-aligned). The layout
// comes from a masked analysis of real files; every value here is invented.
import type { Cell, StatementDocument } from '../../../src/providers/types.ts';

export const IBAN = 'UA990000000000000000000000001';
export const CARD_A = '4000****1111';
export const CARD_B = '4000****2222';

/** The workbook's header: a Latin «i» in «Дата i час», a decomposed «ї» in «Деталі операції», as files come. */
export const HEADER = [
  'Дата i час операції',
  'Номер картки',
  'Деталі операції',
  'MCC',
  'Сума в валюті картки (UAH)',
  'Сума в валюті операції',
  'Валюта',
  'Курс',
  'Сума комісій (UAH)',
  'Сума кешбеку (UAH)',
  'Залишок після операції',
];

/** [time, card, details, MCC, amount, op amount, op currency, rate, fee, cashback, balance], as the bank writes them. */
export type Op = [string, string, string, string, string, string, string, string, string, string, string];

/** Newest first, as the bank writes it. The balance includes a credit limit of 10 000,00. */
export const OPS: Op[] = [
  ['20.01.2026 21:00', CARD_A, 'Вигадана Особа', '4829', '-1 000,00', '-1 000,00', 'UAH', '-', '0,00', '-', '12 800,70'],
  ['18.01.2026 20:00', '-', 'Вигадана аптека, місто', '', '84,20', '84,20', 'UAH', '-', '0,00', '-0,84', '13 800,70'],
  ['15.01.2026 11:01', CARD_B, 'Зарахування кешбеку на картку', '4829', '10,00', '10,00', 'UAH', '-', '0,00', '-', '13 716,50'],
  ['15.01.2026 11:01', CARD_A, 'Зарахування кешбеку на картку', '4829', '32,50', '32,50', 'UAH', '-', '0,00', '-', '13 706,50'],
  ['12.01.2026 08:00', CARD_A, 'Вигаданий банк', '6012', '500,00', '500,00', 'UAH', '-', '0,00', '-', '13 674,00'],
  ['10.01.2026 19:40', CARD_A, 'Зняття готівки', '6010', '-530,00', '-500,00', 'UAH', '-', '30,00', '-', '13 174,00'],
  ['08.01.2026 10:00', CARD_A, 'Вигаданий сервіс', '5399', '-45,60', '-1,00', 'USD', '45.60', '0,00', '0,46', '13 704,00'],
  ['06.01.2026 22:10', '-', 'Скасування. Вигаданий магазин', '5399', '2 000,00', '2 000,00', 'UAH', '-', '0,00', '-20,00', '13 749,60'],
  ['06.01.2026 13:00', CARD_B, 'Вигаданий магазин', '5399', '-2 000,00', '-2 000,00', 'UAH', '-', '0,00', '20,00', '11 749,60'],
  ['05.01.2026 12:00', CARD_A, 'Вигаданий супермаркет', '5411', '-1 250,40', '-1 250,40', 'UAH', '-', '0,00', '12,50', '13 749,60'],
  ['03.01.2026 09:00', CARD_A, 'MONO*VYHADANYI VIDPRAVNYK', '4829', '5 000,00', '5 000,00', 'UAH', '-', '0,00', '-', '15 000,00'],
];

/** The heading lines: [left, right] texts of each line, as the bank sets them above the table. */
export const HEADING: Array<[string, string?]> = [
  ['Клієнт: ВИГАДАНА ОСОБА'],
  ['Інформація по картці: 40000*****001111'],
  [`Рахунок: ${IBAN}`],
  ['Період: 01.01.2026 – 20.01.2026'],
  // «Кредитний» with a decomposed «й», as files come.
  ['Кредитний ліміт (станом на 20.01.2026): 10 000,00 UAH', 'Баланс на початок періоду: 10 000,00 UAH'],
  ['Заборгованість (станом на 20.01.2026): 0,00 UAH', 'Баланс на кінець періоду: 12 800,70 UAH'],
];

const s = (v: string): Cell => ({ t: 's', v });
const WIDTH = 27;
const pad = (cells: Cell[]): Cell[] => [...cells, ...Array.from({ length: WIDTH - cells.length }, () => null)];

export function workbook(ops: Op[] = OPS, opts: { heading?: boolean; cells?: (op: Op) => Cell[] } = {}): StatementDocument {
  const heading = opts.heading === false ? [] : HEADING.map(([left, right]) => pad(right ? [s(left), ...Array.from({ length: 6 }, () => null), s(right)] : [s(left)]));
  return {
    format: 'sheets',
    sheets: [
      {
        name: 'Рух коштів по картці',
        rows: [...heading, pad([]), pad(HEADER.map(s)), ...ops.map((op) => pad((opts.cells ?? ((o: Op) => o.map((v) => (v === '' ? null : s(v)))))(op))), pad([]), pad([])],
      },
    ],
  };
}

type Item = { x: number; y: number; w: number; h: number; text: string };
const CHAR = 4.3;
const at = (x: number, y: number, text: string): Item => ({ x, y, w: Math.round(text.length * CHAR * 100) / 100, h: 7, text });
const right = (edge: number, y: number, text: string) => at(edge - text.length * CHAR, y, text);
const centred = (mid: number, y: number, text: string) => at(mid - (text.length * CHAR) / 2, y, text);

/** The table header over five lines from `y`, the PDF's own spellings (a Cyrillic «МСС», «у валюті карти»). */
function pdfHeader(y: number): Item[] {
  return [
    at(657, y, 'Сума'),
    at(712, y, 'Сума'),
    at(49, y + 5, 'Дата і час'),
    at(413, y + 5, 'Сума у валюті'),
    at(483, y + 5, 'Сума у валюті'),
    at(765, y + 5, 'Залишок'),
    at(114, y + 10, 'Номер картки'),
    at(247, y + 10, 'Деталі операції'),
    at(379, y + 10, 'МСС'),
    at(555, y + 10, 'Валюта'),
    at(608, y + 10, 'Курс'),
    at(652, y + 10, 'комісій'),
    at(704, y + 10, 'кешбеку'),
    at(52, y + 15, 'операції'),
    at(417, y + 15, 'карти (UAH)'),
    at(495, y + 15, 'операції'),
    at(755, y + 15, 'після операціЇ'),
    at(656, y + 20, '(UAH)'),
    at(711, y + 20, '(UAH)'),
  ];
}

/** One operation: its date on the line above, its time below, every other cell on the middle line `y`. */
function pdfRow([time, card, details, mcc, amount, opAmount, currency, rate, fee, cashback, balance]: Op, y: number): Item[] {
  const [date, clock] = time.split(' ') as [string, string];
  return [
    at(49, y - 5, date),
    at(60, y + 5, clock),
    at(116, y, card),
    centred(280, y, details),
    ...(mcc === '' ? [] : [at(379, y, mcc)]),
    right(455, y, amount),
    right(525, y, opAmount),
    at(562, y, currency),
    at(rate === '-' ? 616 : 607, y, rate),
    at(660, y, fee),
    right(734, y, cashback),
    right(800, y, balance),
  ];
}

function pageTop(n: number, of: number, y = 29): Item[] {
  return [
    at(662, y, 'АКЦІОНЕРНЕ ТОВАРИСТВО «АКЦЕНТ-БАНК»'),
    at(662, y + 11, 'вул. Вигадана, 1, м. Вигадане, 00000, Україна'),
    at(48, y + 68, 'від 20.01.2026 13:10'),
    at(383, y + 68, '№ AAAA-0000-0000-AAAA'),
    at(760, y + 68, `Сторінка ${n} з ${of}`),
  ];
}

/** The heading block of page 1: each label with its value close by, the right column far apart. */
function pdfHeading(y: number): Item[] {
  return HEADING.flatMap(([left, rightText], i) => [at(43, y + i * 11, left), ...(rightText ? [at(594, y + i * 11, rightText)] : [])]);
}

const ROW_STEP = 26.5;

/** The PDF: the title and heading on page 1, then `perPage` operations per page under a repeated header. */
export function pdf(ops: Op[] = OPS, opts: { perPage?: number; heading?: boolean; mark?: boolean } = {}): StatementDocument {
  const perPage = opts.perPage ?? 5;
  const pages: Array<{ width: number; height: number; items: Item[] }> = [];
  const count = Math.max(1, Math.ceil(ops.length / perPage));
  for (let n = 0; n < count; n++) {
    const first = n === 0;
    const items: Item[] = opts.mark === false ? [] : pageTop(n + 1, count);
    if (first && opts.mark !== false) items.push(at(363, 130, 'Виписка по картці'));
    if (first && opts.heading !== false) items.push(...pdfHeading(260));
    const headerY = first ? 399 : 121;
    items.push(...pdfHeader(headerY));
    ops.slice(n * perPage, (n + 1) * perPage).forEach((op, i) => items.push(...pdfRow(op, headerY + 42 + i * ROW_STEP)));
    pages.push({ width: 841.89, height: 595.28, items });
  }
  return { format: 'pdf', pages };
}
