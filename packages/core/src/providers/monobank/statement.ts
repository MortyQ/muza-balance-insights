// Monobank's statement files (the CSV the app downloads). Taken: the card statement in Ukrainian — its service texts
// («Від: …», «З Чорної картки» …) are the API's, so the Monobank rules read its rows as they read the API's. The English
// statement translates those texts (`From: …`): refused with its own code, the rules would miss them. The FOP statement
// (a title line with the holder and the IBAN above the columns) is not supported yet.
import { TZDate } from '@date-fns/tz';
import { TIMEZONE } from '../../constants.ts';
import { parseCsv } from '../../csv.ts';
import { currencyExponent, currencyNumeric } from '../../currency.ts';
import type { NormalizedTx, StatementFileParser, StatementParseResult } from '../types.ts';

/** A cell the statement leaves empty: an em dash, or nothing. */
const ABSENT = new Set(['—', '']);

/** Column names compared in one shape: lower case, one space, the Latin «i» the bank may type as the word «і». */
const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim().replace(/(?<= )i(?= )/g, 'і');

type Field = 'time' | 'description' | 'mcc' | 'amount' | 'operationAmount' | 'operationCurrency' | 'rate' | 'commission' | 'cashback' | 'balance';

/** The Ukrainian card statement's columns; `(UAH)` in three of them is the card's currency. */
const CARD_UK: ReadonlyArray<{ field: Field; re: RegExp }> = [
  { field: 'time', re: /^дата і час операції$/ },
  { field: 'description', re: /^деталі операції$/ },
  { field: 'mcc', re: /^mcc$/ },
  { field: 'amount', re: /^сума в валюті картки \(([a-z]{3})\)$/ },
  { field: 'operationAmount', re: /^сума в валюті операції$/ },
  { field: 'operationCurrency', re: /^валюта$/ },
  { field: 'rate', re: /^курс$/ },
  { field: 'commission', re: /^сума комісій \([a-z]{3}\)$/ },
  { field: 'cashback', re: /^сума кешбеку \([a-z]{3}\)$/ },
  { field: 'balance', re: /^залишок після операції$/ },
];

/** The English card statement starts with this column. */
const CARD_EN_FIRST = norm('Date and time');

const TIME_RE = /^(\d{2})\.(\d{2})\.(\d{4}) (\d{2}):(\d{2}):(\d{2})$/;

/** `dd.MM.yyyy HH:mm:ss` in Kyiv time → unix seconds; null if not a real moment. */
function parseTime(s: string): number | null {
  const m = TIME_RE.exec(s.trim());
  if (!m) return null;
  const [d, mo, y, h, mi, se] = m.slice(1).map(Number) as [number, number, number, number, number, number];
  const t = new TZDate(y, mo - 1, d, h, mi, se, TIMEZONE);
  if (t.getFullYear() !== y || t.getMonth() !== mo - 1 || t.getDate() !== d || t.getMinutes() !== mi || t.getSeconds() !== se) return null;
  return Math.floor(t.getTime() / 1000);
}

/** A decimal string → minor units of the currency, without floating point (`-845.5` → -84550); null if it does not read. */
export function toMinor(s: string, currencyCode: number): number | null {
  const m = /^(-)?(\d+)(?:\.(\d+))?$/.exec(s.trim());
  if (!m) return null;
  const exp = currencyExponent(currencyCode);
  const frac = m[3] ?? '';
  // Extra decimals are allowed only as zeros (`1000.0` for a currency without a minor unit).
  if (frac.length > exp && /[^0]/.test(frac.slice(exp))) return null;
  const minor = Number(`${m[2]}${frac.slice(0, exp).padEnd(exp, '0')}`);
  if (!Number.isSafeInteger(minor)) return null;
  return m[1] && minor !== 0 ? -minor : minor;
}

type Columns = Record<Field, number> & { currencyCode: number };

function cardColumns(header: readonly string[]): Columns | null {
  const names = header.map(norm);
  const out: Partial<Record<Field, number>> = {};
  let currencyCode: number | null = null;
  for (const { field, re } of CARD_UK) {
    const i = names.findIndex((n) => re.test(n));
    if (i < 0) return null;
    out[field] = i;
    if (field === 'amount') currencyCode = currencyNumeric(re.exec(names[i] ?? '')?.[1] ?? '');
  }
  if (currencyCode === null) return null;
  return { ...(out as Record<Field, number>), currencyCode };
}

function readRow(cells: readonly string[], header: readonly string[], c: Columns): Omit<NormalizedTx, 'id'> | null {
  const cell = (f: Field) => cells[c[f]] ?? '';
  const present = (f: Field) => !ABSENT.has(cell(f).trim());
  const time = parseTime(cell('time'));
  const mcc = /^\d{1,4}$/.test(cell('mcc').trim()) ? Number(cell('mcc')) : null;
  const amount = toMinor(cell('amount'), c.currencyCode);
  const operationCurrency = present('operationCurrency') ? currencyNumeric(cell('operationCurrency')) : c.currencyCode;
  if (time === null || mcc === null || amount === null || operationCurrency === null) return null;

  const tx: Omit<NormalizedTx, 'id'> = {
    time,
    amount,
    currencyCode: operationCurrency,
    hold: false,
    mcc,
    raw: JSON.stringify(Object.fromEntries(header.map((h, i) => [h, cells[i] ?? '']))),
  };
  const description = cell('description').trim();
  if (description !== '') tx.description = description;
  const optional: Array<[Field, 'operationAmount' | 'commissionRate' | 'cashbackAmount' | 'balance', number]> = [
    ['operationAmount', 'operationAmount', operationCurrency],
    ['commission', 'commissionRate', c.currencyCode],
    ['cashback', 'cashbackAmount', c.currencyCode],
    ['balance', 'balance', c.currencyCode],
  ];
  for (const [field, key, currency] of optional) {
    if (!present(field)) continue;
    const v = toMinor(cell(field), currency);
    if (v === null) return null;
    tx[key] = v;
  }
  return tx;
}

function parse(text: string): StatementParseResult {
  let table: string[][];
  try {
    table = parseCsv(text);
  } catch {
    return { ok: false, problem: 'unknown-format' };
  }
  const header = table[0];
  if (!header) return { ok: false, problem: 'empty' };
  // A title line (the holder, the account, the period) above the columns: the FOP statement.
  if (header.length === 1 && table.length > 1) return { ok: false, problem: 'unsupported-kind' };
  if (norm(header[0] ?? '') === CARD_EN_FIRST) return { ok: false, problem: 'english' };
  const columns = cardColumns(header);
  if (!columns) return { ok: false, problem: 'unknown-format' };

  const rows: Array<Omit<NormalizedTx, 'id'>> = [];
  for (let i = 1; i < table.length; i++) {
    const tx = readRow(table[i] ?? [], header, columns);
    if (!tx) return { ok: false, problem: 'bad-row', row: i + 1 };
    rows.push(tx);
  }
  if (rows.length === 0) return { ok: false, problem: 'empty' };
  // The app writes the newest first; oldest first here, equal seconds keep the file's own order between them.
  rows.reverse();
  rows.sort((a, b) => a.time - b.time);
  const newest = rows.at(-1);
  return {
    ok: true,
    statement: { kind: 'card', currencyCode: columns.currencyCode, rows, closingBalance: newest?.balance ?? null },
  };
}

export const monobankStatement: StatementFileParser = { provider: 'monobank', parse };
