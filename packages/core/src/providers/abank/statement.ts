// A-Bank's card statement in Ukrainian («Виписка по картці»), as a workbook (.xlsx) or a PDF. Both hold heading lines
// (the client, the card, the account's IBAN, the period, the credit limit, the period's totals), then a table of eleven
// columns, newest first, one row per operation, times to the minute. One file is one account: its IBAN and every card
// the rows name (a row may have «-» for none). Rows carry the bank's MCC. The card amount is signed and includes the
// fee; the balance after each operation includes the credit limit. The PDF writes some headers differently from the
// workbook («у валюті карти», a Cyrillic «МСС»); one column list takes both.
import { currencyNumeric } from '../../shared/currency.ts';
import { toMinor } from '../../shared/money.ts';
import { columnsByHeader, gridOf, isEmptyRow, localAmount, pdfTable, wallTime } from '../statement-kit.ts';
import type { NormalizedTx, ParsedStatement, StatementDocument, StatementReadResult, StatementReader } from '../types.ts';

type Field =
  | 'time'
  | 'card'
  | 'description'
  | 'mcc'
  | 'amount'
  | 'operationAmount'
  | 'operationCurrency'
  | 'rate'
  | 'fee'
  | 'cashback'
  | 'balance';

const COLUMNS: ReadonlyArray<{ field: Field; re: RegExp }> = [
  { field: 'time', re: /^дата і час операції$/ },
  { field: 'card', re: /^номер картки$/ },
  { field: 'description', re: /^деталі операції$/ },
  { field: 'mcc', re: /^(?:mcc|мсс)$/ },
  { field: 'amount', re: /^сума [ву] валюті карт(?:ки|и) \(([a-z]{3})\)$/ },
  { field: 'operationAmount', re: /^сума [ву] валюті операції$/ },
  { field: 'operationCurrency', re: /^валюта$/ },
  { field: 'rate', re: /^курс$/ },
  { field: 'fee', re: /^сума комісій \(([a-z]{3})\)$/ },
  { field: 'cashback', re: /^сума кешбеку \(([a-z]{3})\)$/ },
  { field: 'balance', re: /^залишок після операції$/ },
];

/** A PDF row starts at a line with a card amount. */
const AMOUNT_RE = /^-?\d{1,3}(?:[\s  ]\d{3})*,\d{2}$/;

const IBAN_RE = /^Рахунок:\s*(UA\d{27})$/;
const CARD_LINE_RE = /^Інформація по картці:/;
const LIMIT_RE = /^Кредитний ліміт \(станом на \d{2}\.\d{2}\.\d{4}\):\s*(.+?)\s+([A-Z]{3})$/;
const PDF_MARK_RE = /АКЦЕНТ-БАНК|^Виписка по картці$/;

const NONE = '-';

type Table = {
  /** The heading's texts above the table (a cell of the workbook, a line segment of the PDF). */
  heading: string[];
  /** The account currency, named in the card amount's header; null when the fee or cashback names another. */
  currencyCode: number | null;
  rows: Array<{ cells: Record<Field, string>; row: number }>;
  header: string[];
};

/** A heading text in one shape: composed letters (a «й» may come decomposed), one space. */
const squash = (s: string) => s.normalize('NFC').replace(/\s+/g, ' ').trim();

function currencyOf(match: Record<Field, RegExpExecArray>): number | null {
  const code = match.amount[1]!;
  if (match.fee[1] !== code || match.cashback[1] !== code) return null;
  return currencyNumeric(code.toUpperCase());
}

function sheetTable(doc: StatementDocument): Table | null {
  if (doc.format !== 'sheets') return null;
  const grid = gridOf(doc);
  if (!grid) return null;
  const at = grid.findIndex((cells) => columnsByHeader(cells, COLUMNS) !== null);
  if (at < 0) return null;
  const found = columnsByHeader(grid[at]!, COLUMNS)!;
  const rows: Table['rows'] = [];
  for (let i = at + 1; i < grid.length; i++) {
    const cells = grid[i]!;
    if (isEmptyRow(cells)) continue;
    rows.push({ cells: Object.fromEntries(COLUMNS.map(({ field }) => [field, (cells[found[field].index] ?? '').trim()])) as Record<Field, string>, row: i + 1 });
  }
  return {
    heading: grid.slice(0, at).flatMap((cells) => cells.map(squash).filter((c) => c !== '')),
    currencyCode: currencyOf(Object.fromEntries(COLUMNS.map(({ field }) => [field, found[field].match])) as Record<Field, RegExpExecArray>),
    rows,
    header: COLUMNS.map(({ field }) => grid[at]![found[field].index] ?? ''),
  };
}

function pdfStatementTable(doc: StatementDocument): Table | null {
  const t = pdfTable(doc, COLUMNS, 'amount', AMOUNT_RE);
  if (!t) return null;
  return {
    heading: t.heading.map(squash),
    currencyCode: currencyOf(t.header),
    rows: t.rows.map((cells, i) => ({ cells, row: i + 1 })),
    header: COLUMNS.map(({ field }) => t.names[field]),
  };
}

type Row = { card: string | null; tx: Omit<NormalizedTx, 'id'> };

/** A money cell into minor units; `-` (none) or empty → undefined; not money → null. */
function money(text: string, currencyCode: number): number | null | undefined {
  if (text === NONE || text === '') return undefined;
  const plain = localAmount(text);
  return plain === null ? null : toMinor(plain, currencyCode);
}

function readRow(cells: Record<Field, string>, header: readonly string[], currencyCode: number): Row | null {
  const time = wallTime(cells.time);
  const operationCurrency = currencyNumeric(cells.operationCurrency);
  if (time === null || operationCurrency === null) return null;
  const amount = money(cells.amount, currencyCode);
  const operationAmount = money(cells.operationAmount, operationCurrency);
  const fee = money(cells.fee, currencyCode);
  const cashback = money(cells.cashback, currencyCode);
  const balance = money(cells.balance, currencyCode);
  if (amount == null || operationAmount == null || fee === null || cashback === null || balance === null) return null;
  if (cells.mcc !== '' && cells.mcc !== NONE && !/^\d{1,4}$/.test(cells.mcc)) return null;

  const tx: Omit<NormalizedTx, 'id'> = {
    time,
    amount,
    currencyCode: operationCurrency,
    hold: false,
    // The workbook signs it, the stored value follows the card amount's sign either way.
    operationAmount: amount < 0 ? -Math.abs(operationAmount) : Math.abs(operationAmount),
    raw: JSON.stringify(Object.fromEntries(COLUMNS.map(({ field }, i) => [header[i] ?? field, cells[field]]))),
  };
  if (/^\d+$/.test(cells.mcc)) tx.mcc = Number(cells.mcc);
  if (cells.description !== '') tx.description = cells.description.normalize('NFC');
  if (fee !== undefined && fee > 0) tx.commissionRate = fee;
  if (cashback !== undefined && cashback !== 0) tx.cashbackAmount = cashback;
  if (balance !== undefined) tx.balance = balance;
  return { card: cells.card === '' || cells.card === NONE ? null : cells.card, tx };
}

function detect(table: Table | null, marked: (heading: readonly string[]) => boolean): 0 | 1 | 2 {
  if (!table) return 0;
  return marked(table.heading) ? 2 : 1;
}

function read(table: Table | null): StatementReadResult {
  if (!table || table.currencyCode === null) return { ok: false, problem: 'unknown-format' };
  const { currencyCode } = table;

  let iban: string | null = null;
  let creditLimit: number | null = null;
  for (const line of table.heading) {
    iban ??= IBAN_RE.exec(line)?.[1] ?? null;
    const limit = LIMIT_RE.exec(line);
    if (limit && creditLimit === null) {
      const value = currencyNumeric(limit[2]!) === currencyCode ? money(limit[1]!, currencyCode) : null;
      if (value == null) return { ok: false, problem: 'bad-row' };
      creditLimit = value;
    }
  }

  const cards: string[] = [];
  const rows: Array<Omit<NormalizedTx, 'id'>> = [];
  for (const { cells, row } of table.rows) {
    const read = readRow(cells, table.header, currencyCode);
    if (!read) return { ok: false, problem: 'bad-row', row };
    if (read.card !== null && !cards.includes(read.card)) cards.push(read.card);
    rows.push(read.tx);
  }
  if (rows.length === 0) return { ok: false, problem: 'empty' };

  // The bank writes the newest first; oldest first here, equal minutes keep the file's own order between them.
  rows.reverse();
  rows.sort((a, b) => a.time - b.time);
  const statement: ParsedStatement = {
    kind: 'card',
    currencyCode,
    account: { iban, cards, type: null },
    rows,
    closingBalance: rows.at(-1)?.balance ?? null,
    creditLimit,
  };
  return { ok: true, statements: [statement] };
}

const sheetMarked = (heading: readonly string[]) => heading.some((l) => IBAN_RE.test(l) || CARD_LINE_RE.test(l));
const pdfMarked = (heading: readonly string[]) => heading.some((l) => PDF_MARK_RE.test(l));

export const abankCardXlsxReader: StatementReader = {
  provider: 'abank',
  id: 'abank-card-xlsx',
  extensions: ['xlsx'],
  detect: (doc) => detect(sheetTable(doc), sheetMarked),
  read: (doc) => read(sheetTable(doc)),
};

export const abankCardPdfReader: StatementReader = {
  provider: 'abank',
  id: 'abank-card-pdf',
  extensions: ['pdf'],
  detect: (doc) => detect(pdfStatementTable(doc), pdfMarked),
  read: (doc) => read(pdfStatementTable(doc)),
};

export const readers: readonly StatementReader[] = [abankCardXlsxReader, abankCardPdfReader];
