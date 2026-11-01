// The user's own category of a debit: for one operation (manual_categories) or for every debit of its payee
// (payee_categories). Imports never write these tables; the derivation applies them above every automatic rule
// (derive/categories.ts). Each write re-derives categories, scope and crossing before it returns.
import { CATEGORY, payeeKeyOf, payeeOf, recategorize } from '../derive/categories.ts';
import { rederiveCrossing } from '../derive/derived.ts';
import { rescope } from '../derive/scope.ts';
import type { Db } from '../storage/db.ts';

/** What a user may choose for a debit: every category but income, the derived-only ones and «семье». */
export const CHOOSABLE_CATEGORIES: readonly string[] = Object.values(CATEGORY).filter(
  (c) =>
    c !== CATEGORY.ownTransfers &&
    c !== CATEGORY.fees &&
    c !== CATEGORY.transferFees &&
    c !== CATEGORY.family &&
    c !== CATEGORY.income,
);

export class CategoryChoiceError extends Error {
  override name = 'CategoryChoiceError';
}

/** Where a debit's category comes from: the user's choice for it, for its payee, or the automatic rules. */
export type CategorySource = 'operation' | 'payee' | 'auto';

type Debit = { id: string; field: 'counter_name' | 'description' | null; key: string | null };

/** A debit that may take a choice: not an own transfer and not a family transfer. Anything else → error. */
async function debitOf(db: Db, transactionId: string): Promise<Debit> {
  const rs = await db.execute({
    sql: `SELECT id, amount, description, counter_name, is_internal_transfer, transfer_rule FROM transactions WHERE id = ?`,
    args: [transactionId],
  });
  const r = rs.rows[0];
  if (!r) throw new CategoryChoiceError('No such operation');
  if (Number(r.amount) >= 0) throw new CategoryChoiceError('Only a debit takes a chosen category');
  if (Number(r.is_internal_transfer) === 1 || r.transfer_rule === 'family') {
    throw new CategoryChoiceError('A transfer between own or family accounts keeps its category');
  }
  const payee = payeeOf(r.counter_name === null ? null : String(r.counter_name), String(r.description ?? ''));
  return { id: String(r.id), field: payee?.field ?? null, key: payee?.key ?? null };
}

function checkCategory(category: string | null): void {
  if (category !== null && !CHOOSABLE_CATEGORIES.includes(category)) {
    throw new CategoryChoiceError(`Not a choosable category: ${category}`);
  }
}

async function rederiveCategories(db: Db): Promise<number> {
  const changed = await recategorize(db);
  await rescope(db);
  await rederiveCrossing(db);
  return changed;
}

/** Sets (or, with null, removes) the category of one debit. Returns how many rows changed category. */
export async function setOperationCategory(
  db: Db,
  transactionId: string,
  category: string | null,
  atSec: number,
): Promise<{ changed: number }> {
  checkCategory(category);
  const debit = await debitOf(db, transactionId);
  await db.execute(
    category === null
      ? { sql: 'DELETE FROM manual_categories WHERE transaction_id = ?', args: [debit.id] }
      : {
          sql: `INSERT INTO manual_categories (transaction_id, category, set_at) VALUES (?, ?, ?)
                ON CONFLICT (transaction_id) DO UPDATE SET category = excluded.category, set_at = excluded.set_at`,
          args: [debit.id, category, atSec],
        },
  );
  return { changed: await rederiveCategories(db) };
}

/**
 * Sets (or, with null, removes) the category of every debit of this debit's payee, past and future. A debit's own
 * choice still wins. Returns how many rows changed category.
 */
export async function setPayeeCategory(
  db: Db,
  transactionId: string,
  category: string | null,
  atSec: number,
): Promise<{ changed: number }> {
  checkCategory(category);
  const debit = await debitOf(db, transactionId);
  if (debit.field === null || debit.key === null) throw new CategoryChoiceError('The operation names no payee');
  await db.execute(
    category === null
      ? { sql: 'DELETE FROM payee_categories WHERE field = ? AND key = ?', args: [debit.field, debit.key] }
      : {
          sql: `INSERT INTO payee_categories (field, key, category, set_at) VALUES (?, ?, ?, ?)
                ON CONFLICT (field, key) DO UPDATE SET category = excluded.category, set_at = excluded.set_at`,
          args: [debit.field, debit.key, category, atSec],
        },
  );
  return { changed: await rederiveCategories(db) };
}

/** Where each of these operations' category comes from; null — it takes no choice (a credit, an own or family transfer). */
export async function categorySources(db: Db, transactionIds: readonly string[]): Promise<Map<string, CategorySource | null>> {
  const out = new Map<string, CategorySource | null>();
  if (transactionIds.length === 0) return out;
  const marks = transactionIds.map(() => '?').join(', ');
  const rs = await db.execute({
    sql: `SELECT t.id, t.amount, t.description, t.counter_name, t.is_internal_transfer, t.transfer_rule,
                 m.category AS own FROM transactions t LEFT JOIN manual_categories m ON m.transaction_id = t.id
          WHERE t.id IN (${marks})`,
    args: [...transactionIds],
  });
  const payees = await db.execute('SELECT field, key FROM payee_categories');
  const keyed = new Set(payees.rows.map((r) => payeeKeyOf(r.field === 'description' ? 'description' : 'counter_name', String(r.key))));
  for (const r of rs.rows) {
    const id = String(r.id);
    const free = Number(r.amount) < 0 && Number(r.is_internal_transfer) !== 1 && r.transfer_rule !== 'family';
    if (!free) out.set(id, null);
    else if (r.own !== null) out.set(id, 'operation');
    else {
      const p = payeeOf(r.counter_name === null ? null : String(r.counter_name), String(r.description ?? ''));
      out.set(id, p && keyed.has(payeeKeyOf(p.field, p.key)) ? 'payee' : 'auto');
    }
  }
  return out;
}
