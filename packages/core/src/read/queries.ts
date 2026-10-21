// Read-only queries over the real database, shared by the CLI and (phase 5) the MCP tools.
import { CATEGORY } from '../derive/categories.ts';
import type { Db } from '../storage/db.ts';
import { spendingSummary } from './summaries.ts';

export type CategorySpending = {
  /** Account currency (ISO 4217 numeric). Different currencies are never summed together. */
  currency: number;
  category: string;
  /** Ledger lines: a row with a commission counts as two lines (body + commission). */
  lines: number;
  /** Minor units, all ≥ 0. net = gross − refunds. */
  gross: number;
  refunds: number;
  net: number;
};

/**
 * Spending per category and account currency for local_date in [fromDate, toDate] (inclusive).
 * Rules (commission split, internal bodies, refunds) — see spendingSummary in src/read/summaries.ts.
 */
export async function spendingByCategory(db: Db, fromDate: string, toDate: string): Promise<CategorySpending[]> {
  // `now` only feeds the period flags (incomplete, pending holds), which this wrapper drops — the groups don't depend on it.
  const s = await spendingSummary(db, { from: fromDate, to: toDate, groupBy: 'category' }, 0);
  return s.groups.map((g) => ({ currency: g.currency, category: g.key, lines: g.lines, gross: g.gross, refunds: g.refunds, net: g.net }));
}
