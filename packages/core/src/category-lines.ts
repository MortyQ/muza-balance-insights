// Every spending line of one category in a period — the rows behind a figure of spendingSummary, for the desktop's
// category screen. The same lines by construction (spendingLinesSql), so they sum to that figure. Unlike the
// summaries, the answer carries the bank's text (description, comment, counter_name): it is for the user's own
// screen, never for an MCP tool or the anonymised copy.
import type { Db } from './db.ts';
import { SPENDING_LINE_ARGS, SPENDING_LINE_SQL, periodInfo, spendingLinesSql, validateFilters, type Period, type PeriodInfo, type SpendingFilters } from './summaries.ts';

export type CategoryLine = {
  /** The transaction's id; a body and its commission line share it. */
  id: string;
  /** body = the row without its commission; commission = that commission as a «комиссии банка» line. */
  kind: 'body' | 'commission';
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
  /** Cashback of the row, account currency minor units (0 for a commission line). */
  cashback: number;
  /** One half of a purchase–refund pair (refunds.ts). */
  refundPair: boolean;
};

export type CategoryLines = { period: PeriodInfo; lines: CategoryLine[] };

/** The lines of `category` in the period, newest first; filters as in spendingSummary. */
export async function categoryLines(db: Db, q: Period & SpendingFilters & { category: string }, nowSec: number): Promise<CategoryLines> {
  validateFilters(q);
  const period = await periodInfo(db, q, nowSec);
  const from = await spendingLinesSql(db, q);
  const rs = await db.execute({
    sql: `${from.sql}
          SELECT l.id, l.kind, l.time, l.account_id, c.participant_id, l.currency, l.amount, l.op_currency, l.op_amount, l.mcc,
                 t.description, t.comment, t.counter_name, t.hold, t.cashback_amount, t.refund_pair_id
          FROM (SELECT * FROM lines WHERE ${SPENDING_LINE_SQL} AND category = ?) l
          JOIN transactions t ON t.id = l.id
          JOIN accounts a ON a.id = l.account_id
          JOIN connections c ON c.id = a.connection_id
          ORDER BY l.time DESC, l.id, l.kind`,
    args: [...from.args, ...SPENDING_LINE_ARGS, q.category],
  });
  const text = (v: unknown) => (v === null || v === undefined ? null : String(v));
  return {
    period,
    lines: rs.rows.map((r) => {
      const body = r.kind === 'body';
      return {
        id: String(r.id),
        kind: body ? 'body' : 'commission',
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
    }),
  };
}
