// Writes on people and their accounts that change what is derived, so each one re-derives before it returns.
import { refreshCrossing } from '../derive/derived.ts';
import { rederiveCore } from '../derive/rederive.ts';
import { ConnectionError } from '../people/connections.ts';
import type { Db } from '../storage/db.ts';

/** The user's choice for one account; it stays until changed (the bank's sync keeps it). Unknown account → ConnectionError. */
export async function setAccountEnabled(db: Db, accountId: string, enabled: boolean): Promise<void> {
  const rs = await db.execute({
    sql: 'UPDATE accounts SET sync_choice = ? WHERE id = ? RETURNING id',
    args: [enabled ? 1 : 0, accountId],
  });
  if (rs.rows.length === 0) throw new ConnectionError('Такого счёта нет');
  await refreshCrossing(db);
}

export type DeletedConnection = { accounts: number; transactions: number; participantRemoved: boolean };

/**
 * Deletes a connection with all its data (accounts, transactions, coverage, request slot) in one transaction; its
 * participant goes too if it has no other connection. Then everything derived is recomputed: transfers that paired
 * with the deleted rows (family, pair) are re-matched for the rest.
 */
export async function deleteConnection(db: Db, id: number): Promise<DeletedConnection> {
  const c = await db.execute({ sql: 'SELECT participant_id FROM connections WHERE id = ?', args: [id] });
  const row = c.rows[0];
  if (!row) throw new ConnectionError('Такого подключения нет');
  const participantId = Number(row.participant_id);
  const count = await db.execute({
    sql: `SELECT (SELECT COUNT(*) FROM accounts WHERE connection_id = ?) AS accounts,
                 (SELECT COUNT(*) FROM transactions t JOIN accounts a ON a.id = t.account_id WHERE a.connection_id = ?) AS transactions,
                 (SELECT COUNT(*) FROM connections WHERE participant_id = ? AND id <> ?) AS siblings`,
    args: [id, id, participantId, id],
  });
  const n = count.rows[0];
  const own = 'SELECT id FROM accounts WHERE connection_id = ?';
  await db.batch([
    { sql: `DELETE FROM transactions WHERE account_id IN (${own})`, args: [id] },
    { sql: `DELETE FROM sync_state WHERE account_id IN (${own})`, args: [id] },
    { sql: 'DELETE FROM accounts WHERE connection_id = ?', args: [id] },
    { sql: 'DELETE FROM api_calls WHERE connection_id = ?', args: [id] },
    { sql: 'DELETE FROM connections WHERE id = ?', args: [id] },
    { sql: 'DELETE FROM participants WHERE id = ? AND NOT EXISTS (SELECT 1 FROM connections WHERE participant_id = ?)', args: [participantId, participantId] },
  ]);
  await rederiveCore(db);
  return { accounts: Number(n?.accounts ?? 0), transactions: Number(n?.transactions ?? 0), participantRemoved: Number(n?.siblings ?? 0) === 0 };
}
