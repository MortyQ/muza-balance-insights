// ČSOB's payment history (internet banking → account → export), as a CSV text document in English: comma-separated with
// quoted fields, or (the export seen on 2026-11-11) semicolon-separated with bare fields and decimal commas. A title line
// `Payment history <account>/<bank code> on <date time>.`, an empty line, then a 24-column header; one row per
// operation, newest first, a date without a time; trailing rows that fill only the balance are skipped. One file is one
// account, its IBAN computed from the Czech account number. Amounts may come signed or not (the sample seen was
// edited): a sign wins, else the type says the direction. Only the columns read below go into `raw`; the symbols,
// addresses and payer references are never read.
import { currencyNumeric } from '../../shared/currency.ts';
import { toMinor } from '../../shared/money.ts';
import { columnsByHeader, gridOf, localAmount, wallTime } from '../statement-kit.ts';
import type { NormalizedTx, StatementDocument, StatementReadResult, StatementReader } from '../types.ts';
import { CARD_REFUND, CREDIT_TYPES, DEBIT_TYPES, GENERIC_CATEGORIES, TRANSFER_TYPES, typeName } from './descriptions.ts';
import { czIban, czIbanOfSlashed } from './iban.ts';

const ZONE = 'Europe/Prague';

type Field =
  | 'account'
  | 'date'
  | 'amount'
  | 'currency'
  | 'balance'
  | 'counterAccount'
  | 'counterBank'
  | 'counterName'
  | 'type'
  | 'note'
  | 'category'
  | 'original'
  | 'id';

const COLUMNS: ReadonlyArray<{ field: Field; re: RegExp }> = [
  { field: 'account', re: /^account number$/ },
  { field: 'date', re: /^due date$/ },
  { field: 'amount', re: /^amount$/ },
  { field: 'currency', re: /^currency$/ },
  { field: 'balance', re: /^balance$/ },
  { field: 'counterAccount', re: /^counter account$/ },
  { field: 'counterBank', re: /^counter account bank code$/ },
  { field: 'counterName', re: /^counter account name$/ },
  { field: 'type', re: /^transaction type$/ },
  { field: 'note', re: /^note$/ },
  { field: 'category', re: /^category$/ },
  { field: 'original', re: /^original transaction$/ },
  { field: 'id', re: /^id transakce$/ },
];

const TITLE_RE = /^Payment history ([\d-]+\/\d{4}) on /;
/** The header sits under the title and an empty line; a few more lines of slack. */
const HEADER_SEARCH = 6;

type Table = { rows: string[][]; headerAt: number; columns: Record<Field, number>; title: boolean };

/** The export comes comma-separated (quoted) or semicolon-separated (bare): whichever finds the header. */
function tableOf(doc: StatementDocument): Table | null {
  if (doc.format !== 'text') return null;
  for (const separator of [',', ';'] as const) {
    const rows = gridOf(doc, separator);
    if (!rows) continue;
    for (let i = 0; i < Math.min(rows.length, HEADER_SEARCH); i++) {
      const found = columnsByHeader(rows[i] ?? [], COLUMNS);
      if (!found) continue;
      const columns = Object.fromEntries(Object.entries(found).map(([f, c]) => [f, (c as { index: number }).index])) as Record<Field, number>;
      const title = rows.slice(0, i).some((r) => TITLE_RE.test((r[0] ?? '').trim()));
      return { rows, headerAt: i, columns, title };
    }
  }
  return null;
}

/** `250`, `-452,30`, `+1 234.5` → minor units; null when it is not an amount. */
function money(text: string, currencyCode: number): { minor: number; signed: boolean } | null {
  const t = text.trim();
  const signed = /^[-+]/.test(t);
  const plain = localAmount(t.replace(/^\+/, ''));
  const minor = plain === null ? null : toMinor(plain, currencyCode);
  return minor === null ? null : { minor, signed };
}

/** `12,50 EUR` → the amount and its currency; null when absent or not read. */
function original(text: string): { value: string; currencyCode: number } | null {
  const m = /^(.+?)\s+([A-Z]{3})$/.exec(text.trim());
  if (!m) return null;
  const currencyCode = currencyNumeric(m[2]!);
  const value = localAmount(m[1]!.replace(/^[-+]/, ''));
  return currencyCode === null || value === null ? null : { value, currencyCode };
}

/** The merchant of a card row's note (`Amount: …, Place: <merchant>`), or null. */
function placeOf(note: string): string | null {
  const m = /(?:^|,\s*)Place:\s*(.+?)\s*$/.exec(note);
  return m && m[1]!.trim() !== '' ? m[1]!.trim() : null;
}

function counterIbanOf(account: string, bank: string): string | null {
  const a = account.replace(/\s+/g, '').toUpperCase();
  if (/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(a)) return a;
  return czIban(a, bank);
}

type Row = { tx: Omit<NormalizedTx, 'id'>; account: string; currencyCode: number };

function readRow(cells: readonly string[], c: Record<Field, number>): Row | null {
  const cell = (f: Field) => (cells[c[f]] ?? '').trim();
  const currencyCode = currencyNumeric(cell('currency'));
  const date = cell('date');
  if (currencyCode === null || !/^\d{2}\.\d{2}\.\d{4}$/.test(date)) return null;
  const time = wallTime(`${date} 00:00`, ZONE);
  const amount = money(cell('amount'), currencyCode);
  const balance = money(cell('balance'), currencyCode);
  if (time === null || amount === null) return null;

  const rawType = cell('type');
  const type = typeName(rawType);
  let sign: 1 | -1;
  if (amount.signed) sign = amount.minor < 0 ? -1 : 1;
  else if (CREDIT_TYPES.has(type)) sign = 1;
  else if (DEBIT_TYPES.has(type)) sign = -1;
  else return null;
  const value = sign * Math.abs(amount.minor);

  const category = cell('category');
  // A card refund is money back whatever category the bank gives it (it files them under «Income»): its type is kept.
  const bankCategory = category === '' || type === CARD_REFUND || (TRANSFER_TYPES.has(type) && GENERIC_CATEGORIES.has(category)) ? type : category;

  const foreign = original(cell('original'));
  let txCurrency = currencyCode;
  let operationAmount = value;
  if (foreign && foreign.currencyCode !== currencyCode) {
    const minor = toMinor(foreign.value, foreign.currencyCode);
    if (minor === null) return null;
    txCurrency = foreign.currencyCode;
    operationAmount = sign * minor;
  }

  const counterName = cell('counterName');
  const counterIban = cell('counterAccount') === '' ? null : counterIbanOf(cell('counterAccount'), cell('counterBank'));
  const description = placeOf(cell('note')) ?? (counterName !== '' ? counterName : rawType);

  const read: Field[] = ['date', 'amount', 'currency', 'balance', 'counterAccount', 'counterBank', 'counterName', 'type', 'note', 'category', 'original', 'id'];
  const tx: Omit<NormalizedTx, 'id'> = {
    time,
    amount: value,
    currencyCode: txCurrency,
    hold: false,
    operationAmount,
    bankCategory,
    raw: JSON.stringify(Object.fromEntries(read.map((f) => [f, cell(f)]))),
    description: description.normalize('NFC'),
  };
  if (balance !== null) tx.balance = balance.minor;
  if (counterIban !== null) tx.counterIban = counterIban;
  if (counterName !== '') tx.counterName = counterName.normalize('NFC');
  return { tx, account: cell('account'), currencyCode };
}

function detect(doc: StatementDocument): 0 | 1 | 2 {
  const t = tableOf(doc);
  if (!t) return 0;
  return t.title ? 2 : 1;
}

function read(doc: StatementDocument): StatementReadResult {
  const t = tableOf(doc);
  if (!t) return { ok: false, problem: 'unknown-format' };
  const rows: Row[] = [];
  for (let i = t.headerAt + 1; i < t.rows.length; i++) {
    const cells = t.rows[i] ?? [];
    // Trailing rows fill only the balance; empty lines likewise carry no date.
    if ((cells[t.columns.date] ?? '').trim() === '') continue;
    const row = readRow(cells, t.columns);
    const first = rows[0];
    if (!row || (first && (row.account !== first.account || row.currencyCode !== first.currencyCode))) {
      return { ok: false, problem: 'bad-row', row: i + 1 };
    }
    rows.push(row);
  }
  const first = rows[0];
  if (!first) return { ok: false, problem: 'empty' };
  const iban = czIbanOfSlashed(first.account);
  if (iban === null) return { ok: false, problem: 'bad-row', row: t.headerAt + 2 };

  // Newest first in the file: the first row's balance is the closing one; oldest first here, equal days keep the
  // file's own order between them.
  const closingBalance = first.tx.balance ?? null;
  const txs = rows.map((r) => r.tx).reverse();
  txs.sort((a, b) => a.time - b.time);
  return {
    ok: true,
    statements: [{ kind: 'card', currencyCode: first.currencyCode, account: { iban, cards: [], type: null }, rows: txs, closingBalance }],
  };
}

export const csobAccountReader: StatementReader = { provider: 'csob', id: 'csob-account-csv-en', extensions: ['csv'], detect, read };

export const readers: readonly StatementReader[] = [csobAccountReader];
