// Internal transfer detection (between the user's own cards, FOP accounts and jars).
// Runs as a pass AFTER rows are written, because a pair's halves can arrive in different windows.
// Rules, in priority order (each row ends up in at most one pair):
//   pair         same-currency accounts, exact mirror amount
//   pair_fx      different currencies, each side's operation_amount mirrors the other's amount
//   pair_fee     same currency, the debit = credit + commission (transfers from credit funds)
//   jar_reversal an auto top-up rolled back inside the same jar
//   iban         counter_iban is one of the user's own IBANs (single row)
//   text         bank-generated own-transfer description, no pair found (single row)
// A pair or an iban match between accounts of DIFFERENT participants is `family`: not internal (it is spending of the
// sender and income of the receiver when one person is viewed), excluded only when the whole family is viewed.
// Thresholds come from real data (phase 3 report): all mirrors within 0–14 s. What a transfer, an own-transfer text
// or an auto top-up looks like is the provider's (providers/<id>/rules.ts), per account.
import type { Db, Stmt } from './db.ts';
import { accountProviders, providerOf } from './connections.ts';
import { rulesFor } from './providers/rules.ts';
import type { ProviderId, ProviderRules } from './providers/types.ts';

/** Max |Δt| between the two halves of a pair, seconds. */
export const TRANSFER_WINDOW_SEC = 20;

export type TransferRule = 'pair' | 'pair_fx' | 'pair_fee' | 'jar_reversal' | 'iban' | 'text' | 'family';

export type TransferTx = {
  id: string;
  accountId: string;
  time: number;
  amount: number;
  operationAmount: number | null;
  /** Commission in account currency, minor units; already included in `amount`. */
  commissionRate: number;
  mcc: number;
  description: string;
  counterIban: string | null;
};

export type TransferAccount = {
  id: string;
  kind: 'card' | 'jar';
  currencyCode: number;
  iban: string | null;
  title: string | null;
  /** Whose rules apply to this account's rows (its connection's provider). */
  provider: ProviderId;
  /** Whose account it is (its connection's participant): transfers between two participants are `family`. */
  participantId: number;
};

export type TransferMark = { rule: TransferRule; pairId: string | null };

type Edge = { a: TransferTx; b: TransferTx; dt: number };

/**
 * Pure core: decides marks for the given (non-cancelled) rows.
 * Pairs are chosen greedily and strictly one-to-one: smallest |Δt| first, ties by id.
 */
export function detectTransfers(rows: readonly TransferTx[], accounts: readonly TransferAccount[]): Map<string, TransferMark> {
  const acc = new Map(accounts.map((a) => [a.id, a]));
  const providers = new Map(accounts.map((a) => [a.id, a.provider]));
  const rulesOf = (tx: TransferTx): ProviderRules => rulesFor(providerOf(providers, tx.accountId));
  const transferLike = (tx: TransferTx) => rulesOf(tx).isTransferLike(tx);
  const participantOf = (tx: TransferTx) => acc.get(tx.accountId)?.participantId;
  // IBAN → its owner (participant).
  const ownIbans = new Map<string, number>();
  for (const a of accounts) {
    const iban = normalizeIban(a.iban);
    if (iban !== null) ownIbans.set(iban, a.participantId);
  }
  const jarTitles = new Set(
    accounts.filter((a) => a.kind === 'jar' && a.title).map((a) => (a.title as string).trim()),
  );
  const ctx = { jarTitles };
  const sorted = [...rows].sort((x, y) => x.time - y.time || cmp(x.id, y.id));
  const marks = new Map<string, TransferMark>();

  const takePairs = (rule: TransferRule, matches: (a: TransferTx, b: TransferTx) => boolean) => {
    const edges: Edge[] = [];
    for (let i = 0; i < sorted.length; i++) {
      const a = sorted[i] as TransferTx;
      if (marks.has(a.id)) continue;
      // Scan both directions within the window: a is the debit (or jar top-up) side, b the other.
      for (let j = i + 1; j < sorted.length; j++) {
        const b = sorted[j] as TransferTx;
        if (b.time - a.time > TRANSFER_WINDOW_SEC) break;
        if (marks.has(b.id)) continue;
        if (matches(a, b)) edges.push({ a, b, dt: b.time - a.time });
        else if (matches(b, a)) edges.push({ a: b, b: a, dt: b.time - a.time });
      }
    }
    edges.sort((x, y) => x.dt - y.dt || cmp(x.a.id, y.a.id) || cmp(x.b.id, y.b.id));
    for (const e of edges) {
      if (marks.has(e.a.id) || marks.has(e.b.id)) continue;
      const r: TransferRule = participantOf(e.a) === participantOf(e.b) ? rule : 'family';
      marks.set(e.a.id, { rule: r, pairId: e.b.id });
      marks.set(e.b.id, { rule: r, pairId: e.a.id });
    }
  };

  // a = money leaves, b = money arrives.
  takePairs('pair', (a, b) => {
    const [aa, ab] = [acc.get(a.accountId), acc.get(b.accountId)];
    return (
      aa !== undefined && ab !== undefined && a.accountId !== b.accountId &&
      aa.currencyCode === ab.currencyCode &&
      a.amount < 0 && a.amount === -b.amount &&
      transferLike(a) && transferLike(b)
    );
  });

  takePairs('pair_fx', (a, b) => {
    const [aa, ab] = [acc.get(a.accountId), acc.get(b.accountId)];
    return (
      aa !== undefined && ab !== undefined && a.accountId !== b.accountId &&
      aa.currencyCode !== ab.currencyCode &&
      a.amount < 0 && b.amount > 0 &&
      a.operationAmount !== null && b.operationAmount !== null &&
      a.operationAmount === -b.amount && b.operationAmount === -a.amount &&
      transferLike(a) && transferLike(b)
    );
  });

  // The bank takes a commission from the sender: |a.amount| = b.amount + commission.
  takePairs('pair_fee', (a, b) => {
    const [aa, ab] = [acc.get(a.accountId), acc.get(b.accountId)];
    return (
      aa !== undefined && ab !== undefined && a.accountId !== b.accountId &&
      aa.currencyCode === ab.currencyCode &&
      a.amount < 0 && b.amount > 0 && a.commissionRate > 0 &&
      a.amount + a.commissionRate === -b.amount &&
      transferLike(a) && transferLike(b)
    );
  });

  // a = the top-up (+), b = its reversal (−), not earlier than the top-up.
  takePairs('jar_reversal', (a, b) => {
    const aa = acc.get(a.accountId);
    return (
      aa?.kind === 'jar' && a.accountId === b.accountId &&
      a.amount > 0 && a.amount === -b.amount && a.time <= b.time &&
      rulesOf(a).isAutoTopUp(a) && rulesOf(b).isAutoTopUp(b)
    );
  });

  for (const r of sorted) {
    if (marks.has(r.id)) continue;
    const iban = normalizeIban(r.counterIban);
    const owner = iban === null ? undefined : ownIbans.get(iban);
    if (owner !== undefined) {
      marks.set(r.id, { rule: owner === participantOf(r) ? 'iban' : 'family', pairId: null });
    } else if (rulesOf(r).isOwnTransferText(r, ctx)) {
      marks.set(r.id, { rule: 'text', pairId: null });
    }
  }
  return marks;
}

function normalizeIban(iban: string | null): string | null {
  const v = iban?.replace(/\s+/g, '').toUpperCase();
  return v ? v : null;
}

function cmp(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

// ---------- DB pass ----------

export type TimeRange = { from: number; to: number };

type StoredRow = TransferTx & { isCancelled: boolean; pairId: string | null; isInternal: boolean; rule: string | null };

const ROW_COLUMNS = `id, account_id, time, amount, operation_amount, commission_rate, mcc, description, counter_iban,
  is_cancelled, is_internal_transfer, transfer_pair_id, transfer_rule`;

/**
 * Recomputes internal-transfer marks.
 * - No range: every row.
 * - With a range (the window just synced): rows within [from − N, to + N], so pairs straddling the
 *   window edge are found; plus the old partners of those rows. Rows paired with something outside
 *   the reprocessed set are left untouched.
 * Returns the time span of rows whose marks were rewritten (for re-categorization), or null.
 */
export async function markInternalTransfers(db: Db, range?: TimeRange): Promise<TimeRange | null> {
  const accounts = await loadAccounts(db);
  const N = TRANSFER_WINDOW_SEC;

  let candidates: StoredRow[];
  if (!range) {
    candidates = await loadRows(db, 'SELECT ' + ROW_COLUMNS + ' FROM transactions', []);
  } else {
    // Context: anything that could pair with a row in the effective range.
    const context = await loadRows(db, `SELECT ${ROW_COLUMNS} FROM transactions WHERE time BETWEEN ? AND ?`, [
      range.from - 2 * N,
      range.to + 2 * N,
    ]);
    const byId = new Map(context.map((r) => [r.id, r]));
    const affected = new Set(
      context
        .filter((r) => (r.time >= range.from - N && r.time <= range.to + N) || r.isCancelled)
        .map((r) => r.id),
    );
    // Old partners of affected rows are freed too (they may sit just outside the context).
    const partnerIds = [...affected].map((id) => byId.get(id)?.pairId).filter((p): p is string => !!p);
    const missing = partnerIds.filter((p) => !byId.has(p));
    if (missing.length > 0) {
      const extra = await loadRows(
        db,
        `SELECT ${ROW_COLUMNS} FROM transactions WHERE id IN (${missing.map(() => '?').join(', ')})`,
        missing,
      );
      for (const r of extra) byId.set(r.id, r);
    }
    for (const p of partnerIds) affected.add(p);
    // Free = affected, or not locked in a pair (single-row marks may upgrade to a pair).
    candidates = [...byId.values()].filter((r) => affected.has(r.id) || r.pairId === null);
  }
  if (candidates.length === 0) return null;

  const live = candidates.filter((r) => !r.isCancelled);
  const marks = detectTransfers(live, accounts);

  // Write only rows whose mark actually changes.
  const stmts: Stmt[] = [];
  for (const r of candidates) {
    const m = r.isCancelled ? undefined : marks.get(r.id);
    // family is marked (rule + pair) but not internal.
    const next = { internal: m !== undefined && m.rule !== 'family', pairId: m?.pairId ?? null, rule: m?.rule ?? null };
    if (next.internal === r.isInternal && next.pairId === r.pairId && next.rule === r.rule) continue;
    stmts.push({
      sql: `UPDATE transactions SET is_internal_transfer = ?, transfer_pair_id = ?, transfer_rule = ? WHERE id = ?`,
      args: [next.internal ? 1 : 0, next.pairId, next.rule, r.id],
    });
  }
  if (stmts.length > 0) await db.batch(stmts);

  const times = candidates.map((r) => r.time);
  return { from: Math.min(...times), to: Math.max(...times) };
}

async function loadAccounts(db: Db): Promise<TransferAccount[]> {
  const rs = await db.execute(
    'SELECT a.id, a.kind, a.currency_code, a.iban, a.title, c.participant_id FROM accounts a JOIN connections c ON c.id = a.connection_id',
  );
  const providers = await accountProviders(db);
  return rs.rows.map((r) => ({
    provider: providerOf(providers, String(r.id)),
    participantId: Number(r.participant_id),
    id: String(r.id),
    kind: r.kind === 'jar' ? 'jar' : 'card',
    currencyCode: Number(r.currency_code),
    iban: r.iban === null ? null : String(r.iban),
    title: r.title === null ? null : String(r.title),
  }));
}

async function loadRows(db: Db, sql: string, args: Array<string | number>): Promise<StoredRow[]> {
  const rs = await db.execute({ sql, args });
  return rs.rows.map((r) => ({
    id: String(r.id),
    accountId: String(r.account_id),
    time: Number(r.time),
    amount: Number(r.amount),
    operationAmount: r.operation_amount === null ? null : Number(r.operation_amount),
    commissionRate: r.commission_rate === null ? 0 : Number(r.commission_rate),
    mcc: Number(r.mcc),
    description: String(r.description ?? ''),
    counterIban: r.counter_iban === null ? null : String(r.counter_iban),
    isCancelled: Number(r.is_cancelled) === 1,
    pairId: r.transfer_pair_id === null ? null : String(r.transfer_pair_id),
    isInternal: Number(r.is_internal_transfer) === 1,
    rule: r.transfer_rule === null ? null : String(r.transfer_rule),
  }));
}
