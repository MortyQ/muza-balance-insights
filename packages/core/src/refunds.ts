// Refunds that arrive with a different MCC than the purchase (observed: a purchase with MCC 5816,
// its cancellation 50 s later as an MCC 4829 credit). Without pairing, the amount counts twice:
// as spending in the purchase's category and as income. Not a transfer — separate column refund_pair_id.
// Rule: same account, a credit the provider calls a refund candidate (Monobank: MCC 4829, not «Від: …»),
// amount = |purchase|, the purchase not transfer-like, the credit 0–15 min after the purchase, strictly one-to-one
// (smallest Δt, ties by id).
import type { Db, Stmt } from './db.ts';
import { LEGACY_PROVIDER, rulesFor } from './providers/rules.ts';
import type { ProviderId } from './providers/types.ts';
import type { TimeRange } from './transfers.ts';

export const REFUND_WINDOW_SEC = 15 * 60;

export type RefundTx = {
  id: string;
  accountId: string;
  time: number;
  amount: number;
  mcc: number;
  description: string;
  isInternal: boolean;
  /** Whose rules apply (the account's provider); Monobank when absent (before connections). */
  provider?: ProviderId;
};

/** Pure core: id → id of the other half, for both halves of each pair. */
export function detectRefunds(rows: readonly RefundTx[]): Map<string, string> {
  const rules = (r: RefundTx) => rulesFor(r.provider ?? LEGACY_PROVIDER);
  const purchases = rows.filter((r) => !r.isInternal && r.amount < 0 && !rules(r).isTransferLike(r));
  const credits = rows.filter((r) => !r.isInternal && rules(r).isRefundCredit(r));
  const edges: Array<{ p: RefundTx; c: RefundTx; dt: number }> = [];
  for (const c of credits) {
    for (const p of purchases) {
      const dt = c.time - p.time;
      if (p.accountId === c.accountId && p.amount === -c.amount && dt >= 0 && dt <= REFUND_WINDOW_SEC) {
        edges.push({ p, c, dt });
      }
    }
  }
  edges.sort((x, y) => x.dt - y.dt || cmp(x.p.id, y.p.id) || cmp(x.c.id, y.c.id));
  const pairs = new Map<string, string>();
  for (const e of edges) {
    if (pairs.has(e.p.id) || pairs.has(e.c.id)) continue;
    pairs.set(e.p.id, e.c.id);
    pairs.set(e.c.id, e.p.id);
  }
  return pairs;
}

function cmp(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

// ---------- DB pass ----------

type StoredRow = RefundTx & { isCancelled: boolean; pairId: string | null };

const COLUMNS = 'id, account_id, time, amount, mcc, description, is_internal_transfer, is_cancelled, refund_pair_id';

/**
 * Recomputes refund pairs: all rows, or rows within [from − W, to + W] of a synced window plus their
 * old partners (same windowing as the transfer pass). Run after the transfer pass: internal rows are skipped.
 * Returns the time span of rows whose marks were rewritten, or null.
 */
export async function markRefunds(db: Db, range?: TimeRange): Promise<TimeRange | null> {
  const W = REFUND_WINDOW_SEC;
  let candidates: StoredRow[];
  if (!range) {
    candidates = await load(db, `SELECT ${COLUMNS} FROM transactions`, []);
  } else {
    const context = await load(db, `SELECT ${COLUMNS} FROM transactions WHERE time BETWEEN ? AND ?`, [
      range.from - 2 * W,
      range.to + 2 * W,
    ]);
    const byId = new Map(context.map((r) => [r.id, r]));
    const affected = new Set(
      context.filter((r) => (r.time >= range.from - W && r.time <= range.to + W) || r.isCancelled).map((r) => r.id),
    );
    const partnerIds = [...affected].map((id) => byId.get(id)?.pairId).filter((p): p is string => !!p);
    const missing = partnerIds.filter((p) => !byId.has(p));
    if (missing.length > 0) {
      for (const r of await load(db, `SELECT ${COLUMNS} FROM transactions WHERE id IN (${missing.map(() => '?').join(', ')})`, missing)) {
        byId.set(r.id, r);
      }
    }
    for (const p of partnerIds) affected.add(p);
    candidates = [...byId.values()].filter((r) => affected.has(r.id) || r.pairId === null);
  }
  if (candidates.length === 0) return null;

  const pairs = detectRefunds(candidates.filter((r) => !r.isCancelled));
  const stmts: Stmt[] = [];
  for (const r of candidates) {
    const next = r.isCancelled ? null : (pairs.get(r.id) ?? null);
    if (next !== r.pairId) stmts.push({ sql: 'UPDATE transactions SET refund_pair_id = ? WHERE id = ?', args: [next, r.id] });
  }
  if (stmts.length > 0) await db.batch(stmts);

  const times = candidates.map((r) => r.time);
  return { from: Math.min(...times), to: Math.max(...times) };
}

async function load(db: Db, sql: string, args: Array<string | number>): Promise<StoredRow[]> {
  const rs = await db.execute({ sql, args });
  return rs.rows.map((r) => ({
    id: String(r.id),
    accountId: String(r.account_id),
    time: Number(r.time),
    amount: Number(r.amount),
    mcc: Number(r.mcc),
    description: String(r.description ?? ''),
    isInternal: Number(r.is_internal_transfer) === 1,
    isCancelled: Number(r.is_cancelled) === 1,
    pairId: r.refund_pair_id === null ? null : String(r.refund_pair_id),
  }));
}
