// A fictional Slovenská sporiteľňa account statement as the desktop decodes it: a PDF's text items placed as the
// bank's layout places them (A4 portrait; both dates as one item or two, details under the first line, amounts
// right-aligned). The layout comes from a masked analysis of real files; every value here is invented.
import type { StatementDocument } from '../../../src/providers/types.ts';

export const IBAN = 'SK9909000000000000000001';
export const CARD = '4000 00** **** 0001';
const IBAN_SPACED = 'SK99 0900 0000 0000 0000 0001';

type Item = { x: number; y: number; w: number; h: number; text: string };

/** One operation as the bank prints it: the first line's cells, then the detail lines under it. */
export type Op = {
  /** Value date and booking date, `dd.mm.yyyy`. */
  dates: [string, string];
  /** How the two dates come: one item with a space, one glued item, or two items. */
  datesAs?: 'spaced' | 'glued' | 'two';
  type: string;
  amount: string;
  fee?: string;
  /** Detail lines; a line may be [text, x] to place an item elsewhere on it (a «BIC: …» far right). */
  details: Array<string | Array<[string, number]>>;
};

const card = (merchant: string[], ...rest: string[]) => [`Č. k. ${CARD}`, ...merchant, ...rest];

/** Oldest first, as the bank writes it. Amounts in EUR. */
export const OPS: Op[] = [
  { dates: ['02.01.2026', '02.01.2026'], type: 'Platba kartou', amount: '- 12,40', details: card(['BILLA 113-MESTO 01. 01. 2026 18:30:05'], 'Transakcia prostredníctvom GooglePay') },
  {
    dates: ['02.01.2026', '02.01.2026'],
    datesAs: 'glued',
    type: 'Prijatá Okamžitá platba',
    amount: '250,00',
    details: ['SK99 1100 0000 0000 0000 0002: TATRSKBX', 'Názov protiúčtu: VYMYSLENA OSOBA'],
  },
  {
    dates: ['05.01.2026', '05.01.2026'],
    datesAs: 'two',
    type: 'Platba kartou',
    amount: '- 25,00',
    details: card(['VYMYSLENY OBCHOD-MESTO 04. 01.', '2026 10:15:00'], 'Transakcia prostredníctvom Token Vymyslena', 'Penazenka', '1 234,50UAH', 'Výmenný kurz: 49,3800'),
  },
  { dates: ['06.01.2026', '06.01.2026'], type: 'Výber kartou', amount: '- 100,00', fee: '- 2,00', details: card(['999 VYMYSLENA BANKA-MESTO 06. 01. 2026 09:00:00']) },
  { dates: ['07.01.2026', '07.01.2026'], datesAs: 'glued', type: 'Vklad cez ATM', amount: '1 300,00', details: card(['VYMYSLENY ATM-MESTO 07. 01. 2026', '12:00:00']) },
  {
    dates: ['08.01.2026', '08.01.2026'],
    type: 'SEPA platba (elektronicky)',
    amount: '- 80,00',
    details: [[['SK99 0200', 143.2], ['0000 0000 0000 0003', 190.6], ['BIC: VUBASKBX', 293.5]], 'Názov protiúčtu: VYMYSLENA FIRMA'],
  },
  { dates: ['09.01.2026', '09.01.2026'], type: 'Návrat tovaru', amount: '5,00', details: card(['LIDL DAKUJE 9-MESTO 08. 01. 2026 00:00:00'], 'Transakcia prostredníctvom GooglePay') },
  { dates: ['10.01.2026', '10.01.2026'], datesAs: 'two', type: 'Platba kartou', amount: '- 3,20', details: card(['TABAK-PRESS-BILLA VYMYSL. 10. 01. 2026 07:45:10']) },
  {
    dates: ['10.01.2026', '11.01.2026'],
    datesAs: 'glued',
    type: 'Okamžitá platba (elektronicky)',
    amount: '- 40,00',
    details: ['CZ99 0800 0000 0000 0000 0004', 'BIC: GIBACZPX', 'Názov protiúčtu: VYMYSLENA OSOBA'],
  },
];

/** An operation not carried out, as the section after the table prints it. */
const PENDING: Op = {
  dates: ['11.01.2026', '11.01.2026'],
  type: 'Okamžitá platba (elektronicky)',
  amount: '',
  details: [[['GB99 VYMY 0000 0000 0000 05 BIC: VYMYGB21', 143.2]], [['Názov protiúčtu:', 143.2], ['VYMYSLENA OSOBA', 218.2]], '75,00 EUR', 'Dôvod vymysleny'],
};

export const OPENING = '1 000,00';

const CHAR = 4.6;
const it = (x: number, y: number, text: string, w = text.length * CHAR): Item => ({ x, y, w, h: 9, text });
/** A right-aligned number ending at `right`. */
const right = (end: number, y: number, text: string) => it(end - text.length * CHAR, y, text);

const cents = (s: string) => {
  const t = s.replace(/\s/g, '').replace(',', '.');
  return Math.round(Number(t) * 100);
};
const local = (c: number) => {
  const sign = c < 0 ? '- ' : '';
  const [i, f] = (Math.abs(c) / 100).toFixed(2).split('.') as [string, string];
  return `${sign}${i.replace(/\B(?=(\d{3})+$)/g, ' ')},${f}`;
};

export type Options = {
  ops?: Op[];
  /** Operations per page. */
  perPage?: number;
  /** The heading above the first table header; false = none. */
  heading?: boolean;
  /** A wrong printed balance on this 0-based operation. */
  breakBalanceAt?: number;
  /** Overrides of the heading's totals. */
  totals?: Partial<Record<'deposits' | 'withdrawals' | 'closing', string>>;
  /** The «Nezrealizované transakcie» section after the last operation. */
  pending?: boolean;
};

function tableHeader(y: number): Item[] {
  return [
    it(34, y, 'Dátum', 28.2),
    it(86.5, y, 'Dátum', 28.2),
    it(143.2, y, 'Popis', 23.6),
    it(384.1, y, 'Suma', 24.4),
    it(435.1, y, 'Suma', 24.4),
    it(503.1, y, 'Zostatok', 37.9),
    it(34, y + 11, 'valuty', 26.3),
    it(86.5, y + 11, 'zúčtovania', 46.8),
    it(143.2, y + 11, 'transakcie', 44.6),
    it(384.1, y + 11, 'transakcie', 44.6),
    it(435.1, y + 11, 'poplatku', 37.2),
    it(503.1, y + 11, 'po transakcii', 53.8),
  ];
}

/** The items of one operation from line `y`; returns them and the next free line. */
function opItems(op: Op, y: number, balance: string | null): { items: Item[]; next: number } {
  const [value, booking] = op.dates;
  const items: Item[] =
    op.datesAs === 'two'
      ? [it(34, y, value, 45), it(86.5, y, booking, 45)]
      : [it(34, y, op.datesAs === 'glued' ? `${value}${booking}` : `${value} ${booking}`, 104)];
  items.push(it(143.2, y, op.type));
  if (op.amount !== '') items.push(right(429.4, y, op.amount));
  if (op.fee) items.push(right(472, y, op.fee));
  if (balance !== null) items.push(right(561.3, y, balance));
  let line = y;
  for (const detail of op.details) {
    line += 11;
    if (typeof detail === 'string') items.push(it(143.2, line, detail));
    else for (const [text, x] of detail) items.push(it(x, line, text));
  }
  return { items, next: line + 11 };
}

const footer = (code: boolean): Item[] => [
  ...(code ? [it(18.6, 817.8, 'V100_X100_0000000001', 70)] : []),
  it(93.5, 822.7, 'info@slsp.sk', 60.2),
  it(223.9, 822.7, 'Klientske centrum: 0000 000 000', 149.1),
];

/** The statement as the desktop's decoder gives it. */
export function statement(opts: Options = {}): StatementDocument {
  const ops = opts.ops ?? OPS;
  const perPage = opts.perPage ?? 6;
  let balance = cents(OPENING);
  const balances = ops.map((op, i) => {
    balance += cents(op.amount) + (op.fee ? cents(op.fee) : 0);
    return i === opts.breakBalanceAt ? balance + 100 : balance;
  });
  const deposits = ops.reduce((a, op) => a + Math.max(0, cents(op.amount)), 0);
  const withdrawals = ops.reduce((a, op) => a + Math.min(0, cents(op.amount)) + (op.fee ? cents(op.fee) : 0), 0);

  const pageCount = Math.max(1, Math.ceil(ops.length / perPage));
  const pages: StatementDocument & { format: 'pdf' } = { format: 'pdf', pages: [] };
  for (let p = 0; p < pageCount; p++) {
    const items: Item[] = [it(464.8, 40.3, `č. 1/2026 - Strana ${p + 1}/${pageCount}`, 102.1)];
    let y: number;
    if (p === 0) {
      if (opts.heading !== false) {
        items.push(
          it(320.3, 78.7, 'Vymyslena Osoba'),
          it(35.4, 90.4, 'Vymyslena sporitelna, a.s.'),
          it(35.4, 146.8, 'Výpis z Účtu:', 87.3),
          it(126.6, 146.8, 'SPACE účet', 83.6),
          it(44.4, 170.7, 'Názov Účtu', 51.5),
          it(212.7, 170.7, 'Osoba Vymyslena', 58.5),
          it(323.6, 170.7, 'Účtovné obdobie', 76.5),
          it(427.7, 170.7, '01. 01. 2026 - 31. 01. 2026', 122.7),
          it(44.4, 187.7, 'Číslo Účtu', 46.4),
          it(118.8, 187.7, IBAN_SPACED, 152.4),
          it(323.6, 187.7, 'Počiatočný stav Účtu', 95.8),
          right(550.4, 187.7, OPENING),
          it(44.4, 204.8, 'BIC', 15.6),
          it(226.9, 204.8, 'GIBASKBX', 44.2),
          it(323.6, 204.8, 'Vklady spolu', 58.9),
          right(550.4, 204.8, opts.totals?.deposits ?? local(deposits)),
          it(44.4, 221.8, 'Mena', 25.1),
          it(253.4, 221.8, 'EUR', 17.8),
          it(323.6, 221.8, 'Výbery spolu', 60.2),
          right(550.4, 221.8, opts.totals?.withdrawals ?? local(withdrawals)),
          it(44.4, 238.8, 'Dátum vyhotovenia výpisu', 120.4),
          it(214.4, 238.8, '01. 02. 2026', 56.8),
          it(323.6, 238.8, 'Konečný stav Účtu', 84.8),
          right(550.4, 238.8, opts.totals?.closing ?? local(balance)),
        );
      }
      items.push(...tableHeader(266.7));
      y = 303.5;
    } else {
      items.push(it(44.4, 64.2, 'Číslo Účtu', 46.4), it(107.5, 64.2, IBAN_SPACED, 152.4), it(280, 64.2, 'Mena', 25.1), it(330.2, 64.2, 'EUR', 17.8));
      items.push(...tableHeader(88.1));
      y = 124.9;
    }
    for (let i = p * perPage; i < Math.min(ops.length, (p + 1) * perPage); i++) {
      const r = opItems(ops[i]!, y, local(balances[i]!));
      items.push(...r.items);
      y = r.next;
    }
    if (p === pageCount - 1) {
      if (opts.pending) {
        items.push(it(34, y + 13, 'Nezrealizované transakcie:', 136.9));
        items.push(...opItems(PENDING, y + 24, null).items);
      }
      items.push(it(39.7, 783.5, 'Vklad podliehajúci ochrane vkladov v súlade so zákonom.', 515.9));
    }
    items.push(...footer(p === 0));
    pages.pages.push({ width: 595.28, height: 841.89, items });
  }
  return pages;
}
