// Diagnostics of the derivation pass: rows per transfer rule, unpaired own-transfer rows, refund pairs and rows per
// category. Read by the recategorize report (rederive.ts) and the sync status.
import type { Db } from '../storage/db.ts';
import { accountProviders, providerOf } from '../people/connections.ts';
import { rulesFor } from '../providers/rules.ts';
import { numOrNull, textOrNull } from '../shared/sql-values.ts';
import type { TransferRule } from './transfers.ts';

export type TransferDiagnostics = {
  /**
   * Non-cancelled rows per transfer_rule; 'none' = not an internal transfer. `family` only when there are such rows
   * (one participant: the recategorize report stays as it was).
   */
  byRule: Record<Exclude<TransferRule, 'family'> | 'none', number> & { family?: number };
  /**
   * Transfer rows with a bank-generated own-transfer description (Monobank: MCC 4829, incl. «Переказ на картку»)
   * but no pair.
   * Non-zero means a half is missing or outside the synced range; such rows are text-marked or unmarked.
   */
  unpairedService4829: number;
  /** Refunds paired with their purchase by refund_pair (credit rows). */
  refundPairs: number;
};

export async function transferDiagnostics(db: Db): Promise<TransferDiagnostics> {
  const byRule: TransferDiagnostics['byRule'] = { pair: 0, pair_fx: 0, pair_fee: 0, jar_reversal: 0, iban: 0, text: 0, none: 0 };
  const rules = await db.execute(
    `SELECT COALESCE(transfer_rule, 'none') AS rule, COUNT(*) AS n
     FROM transactions WHERE is_cancelled = 0 GROUP BY 1`,
  );
  for (const r of rules.rows) byRule[String(r.rule) as keyof typeof byRule] = Number(r.n);

  const jars = await db.execute(`SELECT title FROM accounts WHERE kind = 'jar' AND title IS NOT NULL`);
  const jarTitles = new Set(jars.rows.map((r) => String(r.title).trim()));
  const unpaired = await db.execute(
    `SELECT account_id, description, mcc, amount, bank_category FROM transactions WHERE is_cancelled = 0 AND transfer_pair_id IS NULL`,
  );
  const providers = await accountProviders(db);
  const unpairedService4829 = unpaired.rows.filter((r) =>
    rulesFor(providerOf(providers, String(r.account_id))).isServiceTransferText(
      { description: String(r.description ?? ''), mcc: numOrNull(r.mcc), amount: Number(r.amount), bankCategory: textOrNull(r.bank_category) },
      { jarTitles },
    ),
  ).length;

  const refunds = await db.execute(
    `SELECT COUNT(*) AS n FROM transactions WHERE is_cancelled = 0 AND refund_pair_id IS NOT NULL AND amount > 0`,
  );
  return { byRule, unpairedService4829, refundPairs: Number(refunds.rows[0]?.n ?? 0) };
}

/** Non-cancelled rows per category (internal transfers show up as «свои переводы»). */
export async function categoryCounts(db: Db): Promise<Array<{ category: string; n: number }>> {
  const rs = await db.execute(
    `SELECT category, COUNT(*) AS n FROM transactions
     WHERE is_cancelled = 0 GROUP BY category ORDER BY n DESC, category`,
  );
  return rs.rows.map((r) => ({ category: String(r.category), n: Number(r.n) }));
}
