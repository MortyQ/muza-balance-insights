// Every spending line of one category in a period — the rows behind a figure of spendingSummary, for the desktop's
// category screen — and the newest operations of a period, for home's «Recent operations». The same lines by construction (spendingLinesSql), so they sum to that figure. Unlike the
// summaries, the answer carries the bank's text (description, comment, counter_name): it is for the user's own
// screen, never for an MCP tool or the anonymised copy.
import type { Db } from '../storage/db.ts';
import { SPENDING_LINE_ARGS, SPENDING_LINE_SQL, spendingLinesSql } from './spending.ts';
import { periodInfo, validateFilters, type Period, type PeriodInfo, type SpendingFilters } from './filters.ts';

export type CategoryLine = {
  /** The transaction's id; a body and its commission line share it. */
  id: string;
  /**
   * body = the row without its commission and transfer fee; commission = that commission as a «комиссии банка» line;
   * transfer_fee = a cross-bank transfer's implicit fee as a «комиссии за переводы» line.
   */
  kind: 'body' | 'commission' | 'transfer_fee';
  /** Unix seconds. */
  time: number;
  accountId: string;
  participantId: number;
  /** Account currency, minor units, sign kept: < 0 spending, > 0 a refund. */
  currency: number;
  amount: number;
  /** The operation currency and amount; null for a commission line. */
  operationCurrency: number | null;
  operationAmount: number | null;
  description: string;
  comment: string | null;
  counterName: string | null;
  mcc: number | null;
  hold: boolean;
  /** Cashback of the row, account currency minor units (0 for a commission or transfer fee line). */
  cashback: number;
  /** One half of a purchase–refund pair (refunds.ts). */
  refundPair: boolean;
};

export type CategoryLines = { period: PeriodInfo; lines: CategoryLine[] };

/** The lines of `category` in the period, newest first; filters as in spendingSummary. */
export async function categoryLines(db: Db, q: Period & SpendingFilters & { category: string }, nowSec: number): Promise<CategoryLines> {
  validateFilters(q);
  const period = await periodInfo(db, q, nowSec);
  const rows = await linesOf(db, q, 'category = ?', [q.category], null);
  return { period, lines: rows.map(lineOf) };
}

export type LatestLine = CategoryLine & { category: string };

/**
 * The newest `limit` operations of the period across every category: body lines only (a commission or transfer fee
 * line is part of its operation), each with its category; filters as in spendingSummary.
 */
export async function latestLines(db: Db, q: Period & SpendingFilters, limit: number, nowSec: number): Promise<{ period: PeriodInfo; lines: LatestLine[] }> {
  validateFilters(q);
  if (!Number.isInteger(limit) || limit < 1) throw new RangeError('limit must be a positive integer');
  const period = await periodInfo(db, q, nowSec);
  const rows = await linesOf(db, q, "kind = 'body'", [], limit);
  return { period, lines: rows.map((r) => ({ ...lineOf(r), category: String(r.category) })) };
}

type Row = Record<string, unknown>;

async function linesOf(db: Db, q: Period & SpendingFilters, where: string, args: Array<string | number>, limit: number | null): Promise<Row[]> {
  const from = await spendingLinesSql(db, q);
  const rs = await db.execute({
    sql: `${from.sql}
          SELECT l.id, l.kind, l.time, l.account_id, c.participant_id, l.currency, l.amount, l.op_currency, l.op_amount, l.mcc, l.category,
                 t.description, t.comment, t.counter_name, t.hold, t.cashback_amount, t.refund_pair_id
          FROM (SELECT * FROM lines WHERE ${SPENDING_LINE_SQL} AND ${where}) l
          JOIN transactions t ON t.id = l.id
          JOIN accounts a ON a.id = l.account_id
          JOIN connections c ON c.id = a.connection_id
          ORDER BY l.time DESC, l.id, l.kind${limit === null ? '' : ' LIMIT ?'}`,
    args: [...from.args, ...SPENDING_LINE_ARGS, ...args, ...(limit === null ? [] : [limit])],
  });
  return rs.rows as Row[];
}

const text = (v: unknown) => (v === null || v === undefined ? null : String(v));

function lineOf(r: Row): CategoryLine {
  const body = r.kind === 'body';
  return {
    id: String(r.id),
    kind: body ? 'body' : r.kind === 'commission' ? 'commission' : 'transfer_fee',
    time: Number(r.time),
    accountId: String(r.account_id),
    participantId: Number(r.participant_id),
    currency: Number(r.currency),
    amount: Number(r.amount),
    operationCurrency: r.op_currency === null ? null : Number(r.op_currency),
    operationAmount: r.op_amount === null ? null : Number(r.op_amount),
    description: String(r.description ?? ''),
    comment: text(r.comment),
    counterName: text(r.counter_name),
    mcc: r.mcc === null ? null : Number(r.mcc),
    hold: Number(r.hold) === 1,
    cashback: body ? Number(r.cashback_amount ?? 0) : 0,
    refundPair: r.refund_pair_id !== null,
  };
}
