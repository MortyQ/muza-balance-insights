// PrivatBank's Privat24 card statement (.xlsx), in Ukrainian («Історія операцій за період») or English («Transaction
// history for the period»), as the first sheet of a workbook: a title row with the period, then ten column headers in
// the file's language (the same columns in the same order), then one row per operation, newest first, and often many
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

type Language = { columns: ReadonlyArray<{ field: Field; re: RegExp }>; title: RegExp };

const UK: Language = {
  columns: [
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
  ],
  title: /^історія операцій за період \d{2}\.\d{2}\.\d{4} - \d{2}\.\d{2}\.\d{4}$/,
};

const EN: Language = {
  columns: [
    { field: 'time', re: /^date$/ },
    { field: 'category', re: /^category$/ },
    { field: 'card', re: /^card$/ },
    { field: 'description', re: /^description$/ },
    { field: 'amount', re: /^amount in card currency$/ },
    { field: 'currency', re: /^card currency$/ },
    { field: 'operationAmount', re: /^amount in transaction currency$/ },
    { field: 'operationCurrency', re: /^transaction currency$/ },
    { field: 'balance', re: /^rest at the end of the period$/ },
    { field: 'balanceCurrency', re: /^rest currency$/ },
  ],
  title: /^transaction history for the period \d{2}\.\d{2}\.\d{4} - \d{2}\.\d{2}\.\d{4}$/,
};

type Columns = Record<Field, number>;

function columnsOf(header: readonly string[] | undefined, lang: Language): Columns | null {
  const found = header ? columnsByHeader(header, lang.columns) : null;
  return found ? (Object.fromEntries(Object.entries(found).map(([f, c]) => [f, (c as { index: number }).index])) as Columns) : null;
}

/** The sheet's table, where its header row is (0, or 1 under the title), and its columns; null when it is not ours. */
function layoutOf(doc: StatementDocument, lang: Language): { grid: string[][]; headerRow: number; columns: Columns; titled: boolean } | null {
  if (doc.format !== 'sheets') return null;
  const grid = gridOf(doc);
  if (!grid) return null;
  const titled = lang.title.test(normHeader(grid[0]?.find((c) => c.trim() !== '') ?? ''));
  const headerRow = titled ? 1 : 0;
  const columns = columnsOf(grid[headerRow], lang);
  return columns ? { grid, headerRow, columns, titled } : null;
}

function detect(doc: StatementDocument, lang: Language): 0 | 1 | 2 {
  const layout = layoutOf(doc, lang);
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

function read(doc: StatementDocument, lang: Language): StatementReadResult {
  const layout = layoutOf(doc, lang);
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

const readerOf = (id: string, lang: Language): StatementReader => ({
  provider: 'privatbank',
  id,
  extensions: ['xlsx'],
  detect: (doc) => detect(doc, lang),
  read: (doc) => read(doc, lang),
});

export const privatbankCardReader = readerOf('privatbank-card-uk', UK);
export const privatbankCardEnReader = readerOf('privatbank-card-en', EN);

export const readers: readonly StatementReader[] = [privatbankCardReader, privatbankCardEnReader];
