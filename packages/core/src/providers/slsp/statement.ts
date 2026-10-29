// Slovenská sporiteľňa's monthly account statement in Slovak («Výpis z Účtu»), a PDF. Page 1's heading holds the
// account (IBAN, currency) and the month's opening balance, totals and closing balance; then a table of six columns,
// oldest first. A row's first line holds both dates (two items, or one over both date columns), the operation type,
// the amount, an optional fee and the balance after it; the details follow under it in the description column: a card
// operation's masked card, merchant and time to the second, a wallet line, an amount in another currency with its
// rate; a transfer's IBAN and counterparty name. Operations not carried out («Nezrealizované transakcie») follow the
// table and are left out. The reader checks the file against itself and refuses one that does not add up.
import { currencyNumeric } from '../../shared/currency.ts';
import { toMinor } from '../../shared/money.ts';
import { localAmount, pdfTable, wallTime } from '../statement-kit.ts';
import type { NormalizedTx, StatementDocument, StatementReadResult, StatementReader } from '../types.ts';

type Field = 'valueDate' | 'bookingDate' | 'description' | 'amount' | 'fee' | 'balance';

const COLUMNS: ReadonlyArray<{ field: Field; re: RegExp }> = [
  { field: 'valueDate', re: /^dátum valuty$/ },
  { field: 'bookingDate', re: /^dátum zúčtovania$/ },
  { field: 'description', re: /^popis transakcie$/ },
  { field: 'amount', re: /^suma transakcie$/ },
  { field: 'fee', re: /^suma poplatku$/ },
  { field: 'balance', re: /^zostatok po transakcii$/ },
];

/** The bank's zone: times and dates are read in it. */
const ZONE = 'Europe/Bratislava';

/** Both dates, read from the two date cells joined: the value date, then the booking date. */
const DATES_RE = /^\d{2}\.\d{2}\.\d{4} ?(\d{2}\.\d{2}\.\d{4})$/;
/** A row's anchor in the booking date column: its own date, or both dates as one item. */
const ANCHOR_RE = /^(?:\d{2}\.\d{2}\.\d{4} ?)?\d{2}\.\d{2}\.\d{4}$/;
/** The footer's document code, the bank's contacts, the deposit insurance note. */
const PAGE_END_RE = /^\S+_\S+_\d+$|info@slsp\.sk|^Vklad podliehajúci/;
const TABLE_END_RE = /^Nezrealizované transakcie:?$/;

const CARD_RE = /^Č\. k\. (.+)$/;
const MOMENT_RE = /^(.*?)\s*(\d{1,2})\. ?(\d{1,2})\. ?(\d{4}) (\d{2}):(\d{2}):(\d{2})$/;
const WALLET_RE = /^Transakcia prostredníctvom\b/;
const RATE_RE = /^Výmenný kurz:/;
const FOREIGN_RE = /^(-?\s?\d[\d    ]*,\d{2}) ?([A-Z]{3})$/;
const IBAN_RE = /^([A-Z]{2}\d{2}(?: ?[A-Z0-9]{1,4}){3,8})(?:\s*:\s*\S+|\s+BIC:\s*\S+)?$/;
const COUNTER_NAME_RE = /^Názov protiúčtu:\s*(.*)$/;

const HEADING = {
  title: 'Výpis z Účtu:',
  bic: 'GIBASKBX',
  iban: 'Číslo Účtu',
  currency: 'Mena',
  opening: 'Počiatočný stav Účtu',
  deposits: 'Vklady spolu',
  withdrawals: 'Výbery spolu',
  closing: 'Konečný stav Účtu',
} as const;

const two = (n: string) => n.padStart(2, '0');

/** `- 1 234,56` → minor units; undefined for an empty cell, null when it is not an amount. */
function money(text: string, currencyCode: number): number | null | undefined {
  if (text.trim() === '') return undefined;
  const plain = localAmount(text.trim().replace(/^-\s+/, '-'));
  return plain === null ? null : toMinor(plain, currencyCode);
}

const table = (doc: StatementDocument) =>
  pdfTable(doc, COLUMNS, 'bookingDate', ANCHOR_RE, { rowBand: 'below', pageEndRe: PAGE_END_RE, tableEndRe: TABLE_END_RE });

type Table = NonNullable<ReturnType<typeof table>>;

/** The segment after a heading label (segments are the heading's text pieces in reading order). */
const after = (heading: readonly string[], label: string) => {
  const at = heading.indexOf(label);
  return at >= 0 ? (heading[at + 1] ?? null) : null;
};

type Row = { tx: Omit<NormalizedTx, 'id'>; card: string | null; sum: number; fee: number; balance: number };

function readRow(cells: Record<Field, string>, lines: Record<Field, string[]>, currencyCode: number): Row | null {
  const booking = DATES_RE.exec(`${cells.valueDate} ${cells.bookingDate}`.trim().replace(/\s+/g, ' '))?.[1];
  const [type, ...details] = lines.description;
  // The numbers sit on the row's first line; a detail item far to the right (a «BIC: …») may fall under them below.
  const sum = money(lines.amount[0] ?? '', currencyCode);
  const fee = money(lines.fee[0] ?? '', currencyCode) ?? 0;
  const balance = money(lines.balance[0] ?? '', currencyCode);
  if (!booking || !type || sum == null || fee === null || balance == null) return null;

  let time = wallTime(`${booking} 00:00`, ZONE);
  let card: string | null = null;
  let description: string | undefined;
  let counterIban: string | undefined;
  let counterName: string | undefined;
  let foreign: { amount: string; currency: string } | null = null;

  const cardLine = details[0] === undefined ? null : CARD_RE.exec(details[0]);
  if (cardLine) {
    card = cardLine[1]!.trim();
    // The merchant runs from the card line down to the line that ends with its moment (wrapped lines joined).
    const rest = details.slice(1);
    const merchant: string[] = [];
    let k = 0;
    for (; k < rest.length; k++) {
      const line = rest[k]!;
      if (WALLET_RE.test(line) || RATE_RE.test(line) || FOREIGN_RE.test(line)) break;
      merchant.push(line);
      const moment = MOMENT_RE.exec(merchant.join(' '));
      if (moment) {
        const [, text, d, mo, y, h, mi, s] = moment as unknown as [string, string, string, string, string, string, string, string];
        time = wallTime(`${two(d)}.${two(mo)}.${y} ${h}:${mi}:${s}`, ZONE);
        merchant.splice(0, merchant.length, text);
        k++;
        break;
      }
    }
    if (merchant.join(' ').trim() !== '') description = merchant.join(' ').trim();
    for (const line of rest.slice(k)) {
      const f = FOREIGN_RE.exec(line);
      if (f) foreign = { amount: f[1]!, currency: f[2]! };
    }
  } else {
    const iban = details[0] === undefined ? null : IBAN_RE.exec(details[0]);
    if (iban) counterIban = iban[1]!.replace(/\s+/g, '');
    for (const line of details) {
      const name = COUNTER_NAME_RE.exec(line);
      if (name && name[1]!.trim() !== '') counterName = name[1]!.trim();
    }
    if (counterName) description = counterName;
    else if (!iban && details.length > 0) description = details.join(' ');
  }
  if (time === null) return null;

  let txCurrency = currencyCode;
  let operationAmount = sum;
  if (foreign) {
    const code = currencyNumeric(foreign.currency);
    const value = code === null ? null : money(foreign.amount, code);
    if (code === null || value == null) return null;
    txCurrency = code;
    operationAmount = sum < 0 ? -Math.abs(value) : Math.abs(value);
  }

  const tx: Omit<NormalizedTx, 'id'> = {
    time,
    amount: sum + fee,
    currencyCode: txCurrency,
    hold: false,
    operationAmount,
    bankCategory: type,
    balance,
    raw: JSON.stringify({ ...cells, description: lines.description }),
  };
  if (description !== undefined) tx.description = description.normalize('NFC');
  if (fee !== 0) tx.commissionRate = Math.abs(fee);
  if (counterIban !== undefined) tx.counterIban = counterIban;
  if (counterName !== undefined) tx.counterName = counterName.normalize('NFC');
  return { tx, card, sum, fee, balance };
}

function detect(t: Table | null): 0 | 1 | 2 {
  if (!t) return 0;
  return t.heading.some((s) => s.startsWith(HEADING.title)) && t.heading.includes(HEADING.bic) ? 2 : 1;
}

function read(t: Table | null): StatementReadResult {
  if (!t) return { ok: false, problem: 'unknown-format' };
  const currencyCode = currencyNumeric(after(t.heading, HEADING.currency) ?? '');
  const ibanText = after(t.heading, HEADING.iban)?.replace(/\s+/g, '') ?? '';
  if (currencyCode === null || !/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(ibanText)) return { ok: false, problem: 'unknown-format' };
  const total = (label: string) => money(after(t.heading, label) ?? '', currencyCode);
  const opening = total(HEADING.opening);
  const deposits = total(HEADING.deposits);
  const withdrawals = total(HEADING.withdrawals);
  const closing = total(HEADING.closing);
  if (opening == null || deposits == null || withdrawals == null || closing == null) return { ok: false, problem: 'unknown-format' };

  const rows: Row[] = [];
  for (const [i, cells] of t.rows.entries()) {
    const row = readRow(cells, t.lines[i]!, currencyCode);
    if (!row) return { ok: false, problem: 'bad-row', row: i + 1 };
    rows.push(row);
  }
  if (rows.length === 0) return { ok: false, problem: 'empty' };

  // The file against itself, in its own order: every balance follows from the one before, the totals add up.
  let balance = opening;
  for (const [i, r] of rows.entries()) {
    if (balance + r.sum + r.fee !== r.balance) return { ok: false, problem: 'bad-row', row: i + 1 };
    balance = r.balance;
  }
  const credits = rows.reduce((a, r) => a + (r.sum > 0 ? r.sum : 0), 0);
  const debits = rows.reduce((a, r) => a + (r.sum < 0 ? r.sum : 0) + r.fee, 0);
  if (credits !== deposits || debits !== withdrawals || balance !== closing) return { ok: false, problem: 'bad-row', row: rows.length };

  const cards: string[] = [];
  for (const r of rows) if (r.card !== null && !cards.includes(r.card)) cards.push(r.card);
  // Oldest first; a card operation's own moment may put it before a date-only row of the same day.
  const txs = rows.map((r) => r.tx).sort((a, b) => a.time - b.time);
  return {
    ok: true,
    statements: [{ kind: 'card', currencyCode, account: { iban: ibanText, cards, type: null }, rows: txs, closingBalance: closing }],
  };
}

export const slspAccountPdfReader: StatementReader = {
  provider: 'slsp',
  id: 'slsp-account-pdf',
  extensions: ['pdf'],
  detect: (doc) => detect(table(doc)),
  read: (doc) => read(table(doc)),
};

export const readers: readonly StatementReader[] = [slspAccountPdfReader];
