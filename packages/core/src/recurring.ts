// Regular payments found in the statement: the bank has no such list in its API, so a payee that is paid about once a
// month for about the same amount is one. Built on the spending lines (spendingLinesSql), so what is not spending
// (own transfers, the family's when viewed whole, cancelled rows) is never a regular payment either. Like
// categoryLines, the answer carries the bank's text: it is for the user's own screen, never an MCP tool or the copy.
import type { Db } from './db.ts';
import { SPENDING_LINE_ARGS, SPENDING_LINE_SQL, spendingLinesSql, validateFilters, type Period, type SpendingFilters } from './summaries.ts';

const DAY = 86_400;
/** A gap between two payments that keeps a series going: a month, or a month skipped. */
const MONTH_GAP = [25, 35] as const;
const SKIPPED_GAP = [55, 70] as const;
/** At least this many payments, of which at least MIN_MONTH_GAPS gaps are one month. */
export const MIN_PAYMENTS = 3;
const MIN_MONTH_GAPS = 2;
/** A payment within ±10% of the series' usual amount (operation currency) belongs to it. */
const AMOUNT_TOLERANCE = 0.1;
/** A series whose last payment is older than this (from now) has ended. */
export const ACTIVE_DAYS = 40;

export type RecurringPayment = {
  /** The id of the last payment's transaction: stable while the series goes on, unique across the answer. */
  id: string;
  /** The last payment's bank text and category. */
  description: string;
  category: string;
  mcc: number | null;
  participantId: number;
  accountId: string;
  /** Account currency of the last payment; `amount` — the usual payment in it, minor units, positive. */
  currency: number;
  amount: number;
  /** The operation currency and the usual payment in it (what the series is matched by). */
  operationCurrency: number;
  operationAmount: number;
  payments: number;
  /** Unix seconds: the first and the last payment of the series; `next` — when the next one is due. */
  first: number;
  last: number;
  next: number;
  /** The last payment is at most ACTIVE_DAYS old. */
  active: boolean;
};

type Line = {
  id: string;
  time: number;
  accountId: string;
  participantId: number;
  currency: number;
  amount: number;
  opCurrency: number;
  opAmount: number;
  description: string;
  category: string;
  mcc: number | null;
  payee: string;
};

/** The payee a series is keyed by: the account paid to, else the description with its varying numbers dropped. */
export function payeeKey(description: string, counterIban: string | null, counterEdrpou: string | null): string {
  if (counterIban) return `iban:${counterIban}`;
  if (counterEdrpou) return `edrpou:${counterEdrpou}`;
  const text = description
    .toLowerCase()
    .replace(/\d{3,}/g, '#')
    .replace(/[^\p{L}\p{N}#]+/gu, ' ')
    .trim();
  return `text:${text}`;
}

const median = (xs: ReadonlyArray<number>): number => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[m]! : Math.round((s[m - 1]! + s[m]!) / 2);
};

const within = (days: number, [lo, hi]: readonly [number, number]) => days >= lo && days <= hi;

/** Payments of one payee split by amount: each joins the group whose usual amount it is within the tolerance of. */
export function amountGroups<T extends { opAmount: number }>(lines: ReadonlyArray<T>): T[][] {
  const groups: T[][] = [];
  for (const l of lines) {
    const g = groups.find((xs) => Math.abs(l.opAmount - median(xs.map((x) => x.opAmount))) <= AMOUNT_TOLERANCE * median(xs.map((x) => x.opAmount)));
    if (g) g.push(l);
    else groups.push([l]);
  }
  return groups;
}

/**
 * The series that ends with the newest payment (oldest first in the result): back from it while each gap is a month
 * or a month skipped. null — shorter than MIN_PAYMENTS or with fewer than MIN_MONTH_GAPS one-month gaps.
 */
export function trailingSeries<T extends { time: number }>(lines: ReadonlyArray<T>): T[] | null {
  const sorted = [...lines].sort((a, b) => a.time - b.time);
  const run = sorted.slice(-1);
  let monthGaps = 0;
  for (let i = sorted.length - 2; i >= 0; i--) {
    const days = (run[0]!.time - sorted[i]!.time) / DAY;
    if (within(days, MONTH_GAP)) monthGaps += 1;
    else if (!within(days, SKIPPED_GAP)) break;
    run.unshift(sorted[i]!);
  }
  return run.length >= MIN_PAYMENTS && monthGaps >= MIN_MONTH_GAPS ? run : null;
}

/** Regular payments among the period's spending, the active first, then by the usual amount (account currency). */
export async function findRecurring(db: Db, q: Period & SpendingFilters, nowSec: number): Promise<RecurringPayment[]> {
  validateFilters(q);
  const from = await spendingLinesSql(db, q);
  const rs = await db.execute({
    sql: `${from.sql}
          SELECT l.id, l.time, l.account_id, c.participant_id, l.currency, l.amount, l.op_currency, l.op_amount, l.mcc, l.category,
                 t.description, t.counter_iban, t.counter_edrpou
          FROM (SELECT * FROM lines WHERE ${SPENDING_LINE_SQL} AND kind = 'body' AND amount < 0) l
          JOIN transactions t ON t.id = l.id
          JOIN accounts a ON a.id = l.account_id
          JOIN connections c ON c.id = a.connection_id
          ORDER BY l.time, l.id`,
    args: [...from.args, ...SPENDING_LINE_ARGS],
  });
  const text = (v: unknown) => (v === null || v === undefined || v === '' ? null : String(v));
  const byPayee = new Map<string, Line[]>();
  for (const r of rs.rows) {
    const description = String(r.description ?? '');
    const amount = -Number(r.amount);
    const opCurrency = r.op_currency === null ? Number(r.currency) : Number(r.op_currency);
    // No operation amount (another currency the bank did not report): the account amount stands in.
    const opAmount = r.op_amount === null ? amount : Math.abs(Number(r.op_amount));
    const payee = `${payeeKey(description, text(r.counter_iban), text(r.counter_edrpou))}|${opCurrency}`;
    const line: Line = {
      id: String(r.id),
      time: Number(r.time),
      accountId: String(r.account_id),
      participantId: Number(r.participant_id),
      currency: Number(r.currency),
      amount,
      opCurrency,
      opAmount,
      description,
      category: String(r.category),
      mcc: r.mcc === null ? null : Number(r.mcc),
      payee,
    };
    byPayee.set(payee, [...(byPayee.get(payee) ?? []), line]);
  }

  const found: RecurringPayment[] = [];
  for (const lines of byPayee.values()) {
    for (const group of amountGroups(lines)) {
      const series = trailingSeries(group);
      if (!series) continue;
      const last = series[series.length - 1]!;
      const gaps = series.slice(1).map((l, i) => l.time - series[i]!.time).filter((s) => within(s / DAY, MONTH_GAP));
      found.push({
        id: last.id,
        description: last.description,
        category: last.category,
        mcc: last.mcc,
        participantId: last.participantId,
        accountId: last.accountId,
        currency: last.currency,
        amount: median(series.filter((l) => l.currency === last.currency).map((l) => l.amount)),
        operationCurrency: last.opCurrency,
        operationAmount: median(series.map((l) => l.opAmount)),
        payments: series.length,
        first: series[0]!.time,
        last: last.time,
        next: last.time + median(gaps),
        active: nowSec - last.time <= ACTIVE_DAYS * DAY,
      });
    }
  }
  return found.sort((a, b) => Number(b.active) - Number(a.active) || b.amount - a.amount || a.id.localeCompare(b.id));
}
