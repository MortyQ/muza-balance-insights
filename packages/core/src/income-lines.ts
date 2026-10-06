// Every income line in a period — the rows behind incomeSummary, for the desktop's income screen. The same rows by
// construction (incomeRowsSql), so they sum to its totals. Unlike the summaries, the answer carries the bank's text
// (description, comment, counter_name): it is for the user's own screen, never for an MCP tool or the anonymised copy.
import { accountProviders, providerOf } from './connections.ts';
import type { Db } from './db.ts';
import { rulesFor } from './providers/rules.ts';
import { incomeRowsSql, incomeSource, periodInfo, validateFilters, type Filters, type IncomeSource, type Period, type PeriodInfo } from './summaries.ts';

export type IncomeLine = {
  id: string;
  /** Unix seconds. */
  time: number;
  accountId: string;
  participantId: number;
  /** Account currency, minor units, > 0. */
  currency: number;
  amount: number;
  /** The operation currency and amount (null when the bank gave no amount in another currency). */
  operationCurrency: number;
  operationAmount: number | null;
  description: string;
  comment: string | null;
  counterName: string | null;
  /** The sender's name of a named transfer («Від: Name» → «Name»), else null. */
  sender: string | null;
  source: IncomeSource;
  hold: boolean;
};

export type IncomeLines = { period: PeriodInfo; lines: IncomeLine[] };

/** The income lines of the period, newest first; filters as in incomeSummary. */
export async function incomeLines(db: Db, q: Period & Filters, nowSec: number): Promise<IncomeLines> {
  validateFilters(q);
  const period = await periodInfo(db, q, nowSec);
  const rs = await db.execute(await incomeRowsSql(db, q));
  const providers = await accountProviders(db);
  const text = (v: unknown) => (v === null || v === undefined ? null : String(v));
  return {
    period,
    lines: rs.rows.map((r) => {
      const provider = providerOf(providers, String(r.account_id));
      const description = String(r.description ?? '');
      return {
        id: String(r.id),
        time: Number(r.time),
        accountId: String(r.account_id),
        participantId: Number(r.participant_id),
        currency: Number(r.currency),
        amount: Number(r.amount),
        operationCurrency: Number(r.op_currency),
        operationAmount: r.op_amount === null ? null : Number(r.op_amount),
        description,
        comment: text(r.comment),
        counterName: text(r.counter_name),
        sender: rulesFor(provider).namedSender(description)?.name.trim() || null,
        source: r.transfer_rule === 'family' ? 'family' : incomeSource(Number(r.mcc), description, provider),
        hold: Number(r.hold) === 1,
      };
    }),
  };
}
