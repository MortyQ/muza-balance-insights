// Fictional ČSOB payment history documents for the reader tests: the layout of the real export (title, empty line,
// 24 columns, newest first, trailing balance-only rows), invented values only.
import type { StatementDocument } from '../../../src/providers/types.ts';

export const HEADER = [
  'account number',
  'due date',
  'amount',
  'currency',
  'balance',
  'counter account',
  'counter account bank code',
  'counter account name',
  'counterparty address',
  'constant symbol',
  'variable symbol',
  'specific symbol',
  'transaction type',
  'standing order name',
  'personal note',
  'note',
  'category',
  'original transaction',
  'rate',
  'end-to-end reference',
  'payer reference',
  'original payer',
  'the final beneficiary',
  'ID transakce',
];

export const ACCOUNT = '123456789/0300';

export type Row = {
  date: string;
  amount: string;
  type: string;
  category?: string;
  balance?: string;
  currency?: string;
  account?: string;
  counterAccount?: string;
  counterBank?: string;
  counterName?: string;
  note?: string;
  original?: string;
  rate?: string;
};

let seq = 0;

export function rowCells(r: Row): string[] {
  seq += 1;
  const cells = new Array<string>(HEADER.length).fill('');
  const set = (name: string, v: string | undefined) => {
    cells[HEADER.indexOf(name)] = v ?? '';
  };
  set('account number', r.account ?? ACCOUNT);
  set('due date', r.date);
  set('amount', r.amount);
  set('currency', r.currency ?? 'CZK');
  set('balance', r.balance ?? '10000');
  set('counter account', r.counterAccount);
  set('counter account bank code', r.counterBank);
  set('counter account name', r.counterName);
  set('transaction type', r.type);
  set('note', r.note);
  set('category', r.category);
  set('original transaction', r.original);
  set('rate', r.rate);
  set('ID transakce', `TESTTRANS-0-${String(seq).padStart(4, '0')}`);
  return cells;
}

const quote = (c: string) => `"${c.replace(/"/g, '""')}"`;
const line = (cells: readonly string[]) => cells.map(quote).join(',');

/** A whole document; rows newest first, as the bank writes them. */
export function csobDocument(rows: readonly Row[], opts: { title?: boolean; trailing?: number } = {}): StatementDocument {
  const lines: string[] = [];
  if (opts.title !== false) lines.push(quote(`Payment history ${ACCOUNT} on 07.10.2026 12:00:00.`), '');
  lines.push(line(HEADER));
  for (const r of rows) lines.push(line(rowCells(r)));
  for (let i = 0; i < (opts.trailing ?? 0); i++) {
    const cells = new Array<string>(HEADER.length).fill('');
    cells[HEADER.indexOf('balance')] = '10000';
    lines.push(line(cells));
  }
  return { format: 'text', text: `${lines.join('\r\n')}\r\n` };
}
