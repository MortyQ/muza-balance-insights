// Writing one span of one account: its rows, the bank's items and its coverage in one transaction, then the
// derivation passes around the span. Shared by the API import (sync.ts) and statement files (statement-import.ts).
import { categorize, loadOverrides, type CategoryOverride } from '../derive/categories.ts';
import type { Db, Stmt } from '../storage/db.ts';
import { toKyivDate } from '../shared/format.ts';
import type { NormalizedTx, ProviderId } from '../providers/types.ts';
import { deriveSpan } from '../derive/rederive.ts';
import type { TimeRange } from '../derive/transfers.ts';
import { getSyncState, type Window } from './plan.ts';

export type CommitResult = {
  upserted: number;
  cancelledHolds: number;
  /** Non-hold transactions in the DB that the API no longer returned. Not touched, only reported. */
  missingNonHolds: number;
  /** The span the derivation passes covered (the window when they failed): the end of an import re-derives it. */
  span: TimeRange;
  /** The rows are committed but deriving them failed: only a full pass (rederiveCore) repairs it. */
  derivationFailed: boolean;
};

const UPSERT_TX = `INSERT INTO transactions (
    id, account_id, time, local_date, description, mcc, original_mcc, hold, amount, operation_amount,
    currency_code, commission_rate, cashback_amount, balance, comment, counter_name, counter_iban,
    counter_edrpou, receipt_id, bank_category, category, is_internal_transfer, is_cancelled, synced_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?)
  ON CONFLICT(id) DO UPDATE SET
    account_id = excluded.account_id, time = excluded.time, local_date = excluded.local_date,
    description = excluded.description, mcc = excluded.mcc, original_mcc = excluded.original_mcc,
    hold = excluded.hold, amount = excluded.amount, operation_amount = excluded.operation_amount,
    currency_code = excluded.currency_code, commission_rate = excluded.commission_rate,
    cashback_amount = excluded.cashback_amount, balance = excluded.balance, comment = excluded.comment,
    counter_name = excluded.counter_name, counter_iban = excluded.counter_iban,
    counter_edrpou = excluded.counter_edrpou, receipt_id = excluded.receipt_id, bank_category = excluded.bank_category,
    is_cancelled = 0, synced_at = excluded.synced_at`;
// On conflict, category / is_internal_transfer / transfer_* are left alone: the pass after the commit
// recomputes them for the window (a row may already be marked internal).

// The bank's item, kept apart from the row statistics scan; written right after its operation, in the same batch.
const UPSERT_RAW = `INSERT INTO transaction_raw (id, raw_json) VALUES (?, ?)
  ON CONFLICT(id) DO UPDATE SET raw_json = excluded.raw_json`;

function upsertStatements(
  accountId: string,
  it: NormalizedTx,
  syncedAt: number,
  overrides: readonly CategoryOverride[],
  provider: ProviderId,
): Stmt[] {
  const description = it.description ?? '';
  // Initial category for a new row, as if not an internal transfer; the pass corrects it if it is.
  const category = categorize(
    {
      description,
      mcc: it.mcc ?? null,
      amount: it.amount,
      bankCategory: it.bankCategory ?? null,
      counterName: it.counterName ?? null,
      isInternalTransfer: false,
      isFamilyTransfer: false,
      provider,
    },
    overrides,
  );
  // Optional API fields → NULL when absent. Never substitute a guessed value (e.g. amount for operationAmount).
  return [
    {
      sql: UPSERT_TX,
      args: [
        it.id, accountId, it.time, toKyivDate(it.time), description, it.mcc ?? null, it.originalMcc ?? null,
        it.hold ? 1 : 0, it.amount, it.operationAmount ?? null, it.currencyCode, it.commissionRate ?? null,
        it.cashbackAmount ?? null, it.balance ?? null, it.comment ?? null, it.counterName ?? null, it.counterIban ?? null, it.counterEdrpou ?? null,
        it.receiptId ?? null, it.bankCategory ?? null, category, syncedAt,
      ],
    },
    { sql: UPSERT_RAW, args: [it.id, it.raw] },
  ];
}

export type CommitRowsInput = {
  provider: ProviderId;
  accountId: string;
  /** The span the rows cover in full: it joins the account's coverage. */
  window: Window;
  items: readonly NormalizedTx[];
  nowSec: number;
  /** The API's window: holds it no longer returns are cancelled. A statement file is not asked about holds. */
  cancelHolds: boolean;
  /** Statements that go first in the same transaction (a statement file's new account). */
  before?: readonly Stmt[];
  warn?: (msg: string) => void;
};

/** A span's statements, built but not run: the rows, hold cancelling and the coverage of one account. */
export type PreparedRows = { stmts: Stmt[]; cancelledHolds: number; missingNonHolds: number };

/**
 * Builds the statements that write one account's rows and its coverage; nothing is written. Refuses a span that would
 * leave a hole in the coverage.
 */
export async function prepareRows(db: Db, input: CommitRowsInput): Promise<PreparedRows> {
  const { accountId, window: w, items, nowSec } = input;

  const state = await getSyncState(db, accountId);
  if (state && (w.from > state.newest || w.to < state.oldest)) {
    throw new Error(`Окно не примыкает к покрытому периоду счёта ${accountId} — это создало бы дыру`);
  }

  let cancelIds: string[] = [];
  let missingNonHolds = 0;
  if (input.cancelHolds) {
    const fetchedIds = new Set(items.map((i) => i.id));
    const existing = await db.execute({
      sql: `SELECT id, hold, time FROM transactions
            WHERE account_id = ? AND time > ? AND time < ? AND is_cancelled = 0`,
      args: [accountId, w.from, w.to],
    });
    const missing = existing.rows.filter((r) => !fetchedIds.has(String(r.id)));
    cancelIds = missing.filter((r) => Number(r.hold) === 1).map((r) => String(r.id));
    const missingNonHold = missing.filter((r) => Number(r.hold) !== 1);
    for (const r of missingNonHold) {
      input.warn?.(
        `Транзакция ${String(r.id)} (${toKyivDate(Number(r.time))}, счёт ${accountId}) не холд, но больше не приходит из API — оставляю как есть`,
      );
    }
    missingNonHolds = missingNonHold.length;
  }

  const overrides = await loadOverrides(db);
  const stmts: Stmt[] = [...(input.before ?? []), ...items.flatMap((it) => upsertStatements(accountId, it, nowSec, overrides, input.provider))];
  if (cancelIds.length > 0) {
    stmts.push({
      sql: `UPDATE transactions SET is_cancelled = 1, synced_at = ?
            WHERE id IN (${cancelIds.map(() => '?').join(', ')}) AND hold = 1`,
      args: [nowSec, ...cancelIds],
    });
  }
  stmts.push({
    sql: `INSERT INTO sync_state (account_id, oldest_synced_time, newest_synced_time, last_sync_at)
          VALUES (?, ?, ?, ?)
          ON CONFLICT(account_id) DO UPDATE SET
            oldest_synced_time = MIN(oldest_synced_time, excluded.oldest_synced_time),
            newest_synced_time = MAX(newest_synced_time, excluded.newest_synced_time),
            last_sync_at = excluded.last_sync_at`,
    args: [accountId, w.from, w.to, nowSec],
  });
  return { stmts, cancelledHolds: cancelIds.length, missingNonHolds };
}

/**
 * The derivation passes around a committed span. The rows are already committed: a failure here must not stop the
 * import, it is reported (`derivationFailed`) and only a full pass repairs it.
 */
export async function deriveCommitted(
  db: Db,
  w: Window,
  where: string,
  warn?: (msg: string) => void,
): Promise<{ span: TimeRange; derivationFailed: boolean }> {
  // Transfer pairs may straddle windows/accounts, so the pass looks around the window.
  try {
    return { span: (await deriveSpan(db, w)).span, derivationFailed: false };
  } catch (err) {
    warn?.(
      `Окно ${toKyivDate(w.from)} … ${toKyivDate(w.to)} счёта ${where} сохранено, но разметка переводов/категорий/scope ` +
        `не обновлена (${err instanceof Error ? err.message : 'неизвестная ошибка'}). Запусти recategorize.`,
    );
    return { span: { from: w.from, to: w.to }, derivationFailed: true };
  }
}

/**
 * Rows of one account and its coverage in ONE transaction, then the derivation passes around the span. Refuses a span
 * that would leave a hole in the coverage (nothing is written).
 */
export async function commitRows(db: Db, input: CommitRowsInput): Promise<CommitResult> {
  const prepared = await prepareRows(db, input);
  await db.batch(prepared.stmts);
  const { span, derivationFailed } = await deriveCommitted(db, input.window, input.accountId, input.warn);
  return {
    upserted: input.items.length,
    cancelledHolds: prepared.cancelledHolds,
    missingNonHolds: prepared.missingNonHolds,
    span,
    derivationFailed,
  };
}
