// searchTransactions — individual operations for the search_transactions tool.
// Text matching runs in JS (SQLite LOWER/LIKE do not fold Cyrillic case) over description + counter_name,
// so a full name in the query still matches; the answer shows names only as initials (displayCounterName),
// unless the user turned on settings.reveal_full_names.
import type { Db } from './db.ts';
import { toMajor } from './currency.ts';
import { accountLabels, displayCounterName, toKyivDateTime } from './format.ts';
import { isFromPrefixDescription, isTransferServiceDescription, isTreasuryDescription } from './masking.ts';
import { getSettings } from './settings.ts';
import { isScope, type Scope } from './scope.ts';
import { SummaryError, periodInfo, validatePeriod, type PeriodInfo } from './summaries.ts';

export const SEARCH_DEFAULT_LIMIT = 50;
export const SEARCH_MAX_LIMIT = 200;

export type SearchQuery = {
  from: string;
  to: string;
  /** ISO numeric operation currency, e.g. 8 = ALL. */
  operationCurrency?: number;
  text?: string;
  /** Absolute amount in the ACCOUNT currency, major units (e.g. 500 = 500 ₴), inclusive. */
  minAmount?: number;
  maxAmount?: number;
  category?: string;
  scope?: Scope;
  accountId?: string;
  limit?: number;
};

export type FoundTransaction = {
  id: string;
  /** Kyiv local date-time "YYYY-MM-DD HH:mm". */
  time: string;
  /** Account currency (what was debited / credited), minor units, sign kept (< 0 = debit). */
  amount: number;
  currency: number;
  operationAmount: number;
  operationCurrency: number;
  /** Description with names reduced to initials, card numbers and jar titles hidden. */
  merchant: string;
  /** counter_name as initials, or null. */
  counterparty: string | null;
  category: string;
  mcc: number;
  account: string;
  scope: string;
  internal: boolean;
  hold: boolean;
};

export type SearchTotals = { currency: number; lines: number; debits: number; credits: number };

export type SearchResult = {
  period: PeriodInfo;
  /** All matches, before the limit. */
  total: number;
  truncated: boolean;
  limit: number;
  transactions: FoundTransaction[];
  /** Over ALL matches, per account currency (minor units, debits/credits ≥ 0). */
  totals: SearchTotals[];
  /** Over ALL matches, per operation currency — each in its own currency, never summed together. */
  operationTotals: SearchTotals[];
};

/** Case- and form-insensitive text for matching: NFKC, Ukrainian lower case, ё→е, one kind of apostrophe, single spaces. */
export function normalizeSearch(s: string): string {
  return s
    .normalize('NFKC')
    .toLocaleLowerCase('uk')
    .replace(/ё/g, 'е')
    .replace(/[’`ʼ‘]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

const CARD_PAN = /^\d{6}\*+\d{4}$/;
const JAR_LABEL = 'банка';

/**
 * What the model sees instead of the raw description:
 * - «Від: Name» → «Від: N. S.»; a description containing counter_name → initials of the whole description;
 * - a masked card number → «[картка]»; a jar title → «банка»;
 * - an MCC 4829 transfer that is not a bank template or a treasury payment is a person's name → initials.
 * Everything else (merchants, bank templates) as is. reveal = settings.reveal_full_names.
 */
export function merchantForOutput(
  description: string,
  counterName: string | null,
  mcc: number,
  jarTitles: ReadonlySet<string>,
  reveal: boolean,
): string {
  let d = description.trim();
  for (const title of jarTitles) if (title) d = d.split(title).join(JAR_LABEL);
  if (reveal) return d;
  if (isFromPrefixDescription(d)) return `Від: ${displayCounterName(d.slice(d.indexOf(':') + 1), false) ?? ''}`.trim();
  if (CARD_PAN.test(d)) return '[картка]';
  const name = counterName?.trim();
  if (name && normalizeSearch(d).includes(normalizeSearch(name))) return displayCounterName(d, false) ?? '';
  if (mcc === 4829 && d !== JAR_LABEL && !isTransferServiceDescription(d, jarTitles, { includeGeneric: true }) && !isTreasuryDescription(d)) {
    return displayCounterName(d, false) ?? '';
  }
  return d;
}

export async function searchTransactions(db: Db, q: SearchQuery, nowSec: number): Promise<SearchResult> {
  validatePeriod(q);
  if (q.scope !== undefined && !isScope(q.scope)) throw new SummaryError(`scope: personal или business, получено «${String(q.scope)}»`);
  const limit = q.limit ?? SEARCH_DEFAULT_LIMIT;
  if (!Number.isInteger(limit) || limit < 1 || limit > SEARCH_MAX_LIMIT) throw new SummaryError(`limit: целое от 1 до ${SEARCH_MAX_LIMIT}`);
  if (q.minAmount !== undefined && q.maxAmount !== undefined && q.minAmount > q.maxAmount) {
    throw new SummaryError('min_amount больше max_amount');
  }
  const period = await periodInfo(db, q, nowSec);

  const where = ['t.is_cancelled = 0', 't.local_date BETWEEN ? AND ?'];
  const args: Array<string | number> = [q.from, q.to];
  if (q.operationCurrency !== undefined) (where.push('t.currency_code = ?'), args.push(q.operationCurrency));
  if (q.category) (where.push('t.category = ?'), args.push(q.category));
  if (q.scope) (where.push('t.scope = ?'), args.push(q.scope));
  if (q.accountId) (where.push('t.account_id = ?'), args.push(q.accountId));
  const rs = await db.execute({
    sql: `SELECT t.id, t.account_id, t.time, t.description, t.counter_name, t.mcc, t.amount, t.operation_amount,
                 t.currency_code AS op_currency, a.currency_code AS currency, t.category, t.scope,
                 t.is_internal_transfer, t.hold
          FROM transactions t JOIN accounts a ON a.id = t.account_id
          WHERE ${where.join(' AND ')}
          ORDER BY t.time DESC, t.id`,
    args,
  });

  const needle = q.text ? normalizeSearch(q.text) : '';
  const matches = rs.rows.filter((r) => {
    if (needle && !normalizeSearch(`${String(r.description ?? '')} ${String(r.counter_name ?? '')}`).includes(needle)) return false;
    const abs = Math.abs(toMajor(Number(r.amount), Number(r.currency)));
    if (q.minAmount !== undefined && abs < q.minAmount) return false;
    if (q.maxAmount !== undefined && abs > q.maxAmount) return false;
    return true;
  });

  const accounts = await db.execute('SELECT id, kind, type, currency_code, title FROM accounts');
  const labels = accountLabels(
    accounts.rows.map((r) => ({ id: String(r.id), kind: String(r.kind), type: r.type === null ? null : String(r.type), currencyCode: Number(r.currency_code) })),
  );
  const jarTitles = new Set(accounts.rows.filter((r) => r.kind === 'jar' && r.title).map((r) => String(r.title).trim()));
  const reveal = (await getSettings(db)).reveal_full_names;

  const sum = (key: 'currency' | 'op_currency', amountCol: 'amount' | 'operation_amount') => {
    const by = new Map<number, SearchTotals>();
    for (const r of matches) {
      const c = Number(r[key]);
      const a = Number(r[amountCol] ?? r.amount);
      const t = by.get(c) ?? { currency: c, lines: 0, debits: 0, credits: 0 };
      t.lines += 1;
      if (a < 0) t.debits -= a;
      else t.credits += a;
      by.set(c, t);
    }
    return [...by.values()].sort((x, y) => x.currency - y.currency);
  };

  return {
    period,
    total: matches.length,
    truncated: matches.length > limit,
    limit,
    transactions: matches.slice(0, limit).map((r) => {
      const counterName = r.counter_name === null ? null : String(r.counter_name);
      return {
        id: String(r.id),
        time: toKyivDateTime(Number(r.time)),
        amount: Number(r.amount),
        currency: Number(r.currency),
        operationAmount: Number(r.operation_amount ?? r.amount),
        operationCurrency: Number(r.op_currency),
        merchant: merchantForOutput(String(r.description ?? ''), counterName, Number(r.mcc), jarTitles, reveal),
        counterparty: displayCounterName(counterName, reveal),
        category: String(r.category),
        mcc: Number(r.mcc),
        account: labels.get(String(r.account_id)) ?? String(r.account_id),
        scope: String(r.scope),
        internal: Number(r.is_internal_transfer) === 1,
        hold: Number(r.hold) === 1,
      };
    }),
    totals: sum('currency', 'amount'),
    operationTotals: sum('op_currency', 'operation_amount'),
  };
}

