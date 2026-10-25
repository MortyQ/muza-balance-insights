// PrivatBank's Privat24 card statement (.xlsx, «Історія операцій за період»), as the first sheet of a workbook: a title
// row with the period, then ten Ukrainian column headers, then one row per operation, newest first, and often many
// empty formatted rows after them. Rows of several cards may share one file: one statement per card (a card is its own
// account; the file states no IBAN). No MCC: the bank's own category per row. The card amount is signed; the
// operation amount is not. A debit that cost more than the operation carries the bank's fee on top.
import { currencyNumeric } from '../../shared/currency.ts';
import { toMinor } from '../../shared/money.ts';
import { columnsByHeader, gridOf, isEmptyRow, normHeader, wallTime } from '../statement-kit.ts';
import type { NormalizedTx, ParsedStatement, StatementDocument, StatementReadResult, StatementReader } from '../types.ts';

type Field =
  | 'time'
  | 'category'
  | 'card'
  | 'description'
  | 'amount'
  | 'currency'
  | 'operationAmount'
  | 'operationCurrency'
  | 'balance'
  | 'balanceCurrency';

const COLUMNS: ReadonlyArray<{ field: Field; re: RegExp }> = [
  { field: 'time', re: /^дата$/ },
  { field: 'category', re: /^категорія$/ },
  { field: 'card', re: /^картка$/ },
  { field: 'description', re: /^опис операції$/ },
  { field: 'amount', re: /^сума в валюті картки$/ },
  { field: 'currency', re: /^валюта картки$/ },
  { field: 'operationAmount', re: /^сума в валюті транзакції$/ },
  { field: 'operationCurrency', re: /^валюта транзакції$/ },
  { field: 'balance', re: /^залишок на кінець періоду$/ },
  { field: 'balanceCurrency', re: /^валюта залишку$/ },
];

const TITLE_RE = /^історія операцій за період \d{2}\.\d{2}\.\d{4} - \d{2}\.\d{2}\.\d{4}$/;

type Columns = Record<Field, number>;

function columnsOf(header: readonly string[] | undefined): Columns | null {
  const found = header ? columnsByHeader(header, COLUMNS) : null;
  return found ? (Object.fromEntries(Object.entries(found).map(([f, c]) => [f, (c as { index: number }).index])) as Columns) : null;
}

/** The sheet's table, where its header row is (0, or 1 under the title), and its columns; null when it is not ours. */
function layoutOf(doc: StatementDocument): { grid: string[][]; headerRow: number; columns: Columns; titled: boolean } | null {
  if (doc.format !== 'sheets') return null;
  const grid = gridOf(doc);
  if (!grid) return null;
  const titled = TITLE_RE.test(normHeader(grid[0]?.find((c) => c.trim() !== '') ?? ''));
  const headerRow = titled ? 1 : 0;
  const columns = columnsOf(grid[headerRow]);
  return columns ? { grid, headerRow, columns, titled } : null;
}

function detect(doc: StatementDocument): 0 | 1 | 2 {
  const layout = layoutOf(doc);
  if (!layout) return 0;
  return layout.titled ? 2 : 1;
}

type Row = { card: string; currencyCode: number; tx: Omit<NormalizedTx, 'id'> };

function readRow(cells: readonly string[], header: readonly string[], c: Columns): Row | null {
  const cell = (f: Field) => (cells[c[f]] ?? '').trim();
  const time = wallTime(cell('time'));
  const card = cell('card');
  const currencyCode = currencyNumeric(cell('currency'));
  const operationCurrency = currencyNumeric(cell('operationCurrency'));
  if (time === null || card === '' || currencyCode === null || operationCurrency === null) return null;
  const amount = toMinor(cell('amount'), currencyCode);
  const operationAmount = toMinor(cell('operationAmount'), operationCurrency);
  if (amount === null || operationAmount === null || operationAmount < 0) return null;

  const tx: Omit<NormalizedTx, 'id'> = {
    time,
    amount,
    currencyCode: operationCurrency,
    hold: false,
    operationAmount: amount < 0 ? -operationAmount : operationAmount,
    raw: JSON.stringify(Object.fromEntries(header.map((h, i) => [h, cells[i] ?? '']))),
  };
  const category = cell('category');
  if (category !== '') tx.bankCategory = category;
  const description = cell('description');
  if (description !== '') tx.description = description;
  // The fee on top of a debit in its own currency; a credit keeps what it brought (design 3).
  if (operationCurrency === currencyCode && amount < 0 && -amount > operationAmount) tx.commissionRate = -amount - operationAmount;
  if (cell('balance') !== '') {
    if (currencyNumeric(cell('balanceCurrency')) !== currencyCode) return null;
    const balance = toMinor(cell('balance'), currencyCode);
    if (balance === null) return null;
    tx.balance = balance;
  }
  return { card, currencyCode, tx };
}

function read(doc: StatementDocument): StatementReadResult {
  const layout = layoutOf(doc);
  if (!layout) return { ok: false, problem: 'unknown-format' };
  const { grid, headerRow, columns } = layout;
  const header = grid[headerRow] ?? [];

  const byCard = new Map<string, { currencyCode: number; rows: Array<Omit<NormalizedTx, 'id'>> }>();
  for (let i = headerRow + 1; i < grid.length; i++) {
    const cells = grid[i] ?? [];
    if (isEmptyRow(cells)) continue;
    const row = readRow(cells, header, columns);
    const kept = row ? byCard.get(row.card) : undefined;
    if (!row || (kept && kept.currencyCode !== row.currencyCode)) return { ok: false, problem: 'bad-row', row: i + 1 };
    if (kept) kept.rows.push(row.tx);
    else byCard.set(row.card, { currencyCode: row.currencyCode, rows: [row.tx] });
  }
  if (byCard.size === 0) return { ok: false, problem: 'empty' };

  const statements: ParsedStatement[] = [...byCard].map(([card, { currencyCode, rows }]) => {
    // The bank writes the newest first; oldest first here, equal seconds keep the file's own order between them.
    rows.reverse();
    rows.sort((a, b) => a.time - b.time);
    return { kind: 'card', currencyCode, account: { iban: null, cards: [card], type: null }, rows, closingBalance: rows.at(-1)?.balance ?? null };
  });
  return { ok: true, statements };
}

export const privatbankCardReader: StatementReader = { provider: 'privatbank', id: 'privatbank-card-uk', extensions: ['xlsx'], detect, read };

export const readers: readonly StatementReader[] = [privatbankCardReader];
