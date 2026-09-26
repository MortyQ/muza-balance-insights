// Managing people and their connections (the desktop app's «Люди и подключения»). A participant's label is personal
// data: it lives in this database only — never in the analysis copy, logs or the recategorize report.
import { ConnectionError, PARTICIPANT_LABEL_MAX, parseProviderId } from './connections.ts';
import type { Db } from './db.ts';
import { toKyivDate, toKyivDateTime } from './format.ts';
import type { ProviderId } from './providers/types.ts';
import { rederiveCore } from './rederive.ts';

/** Label of a participant whose name the bank will give on the first import. */
export const BANK_LABEL_PLACEHOLDER = 'Новый участник';

export type LabelSource = 'user' | 'bank';

export type Participant = { id: number; label: string; labelSource: LabelSource };

export type ConnectionInfo = {
  id: number;
  participantId: number;
  provider: ProviderId;
  accounts: number;
  /** Kyiv dates of the range covered by all its imported accounts; null = nothing imported yet. */
  coveredFrom: string | null;
  coveredTo: string | null;
  lastSyncAt: string | null;
};

/** Trimmed, inner whitespace collapsed; empty or too long → ConnectionError. */
export function normalizeLabel(label: string): string {
  const v = label.replace(/\s+/g, ' ').trim();
  if (v.length === 0 || v.length > PARTICIPANT_LABEL_MAX) {
    throw new ConnectionError(`Имя — от 1 до ${PARTICIPANT_LABEL_MAX} символов`);
  }
  return v;
}

export async function listParticipants(db: Db): Promise<Participant[]> {
  const rs = await db.execute('SELECT id, label, label_source FROM participants ORDER BY sort, id');
  return rs.rows.map((r) => ({
    id: Number(r.id),
    label: String(r.label),
    labelSource: r.label_source === 'bank' ? 'bank' : 'user',
  }));
}

/** A new participant, last in the order: with a typed name, or waiting for the bank's name. */
export async function addParticipant(db: Db, who: { label: string } | { fromBank: true }, nowSec: number): Promise<number> {
  const [label, source] = 'label' in who ? [normalizeLabel(who.label), 'user'] : [BANK_LABEL_PLACEHOLDER, 'bank'];
  const rs = await db.execute({
    sql: `INSERT INTO participants (label, label_source, sort, created_at)
          VALUES (?, ?, (SELECT COALESCE(MAX(sort), -1) + 1 FROM participants), ?) RETURNING id`,
    args: [label, source, nowSec],
  });
  return Number(rs.rows[0]?.id);
}

/** The user's name wins from now on: the bank no longer changes it. */
export async function renameParticipant(db: Db, id: number, label: string): Promise<void> {
  const rs = await db.execute({
    sql: `UPDATE participants SET label = ?, label_source = 'user' WHERE id = ? RETURNING id`,
    args: [normalizeLabel(label), id],
  });
  if (rs.rows.length === 0) throw new ConnectionError('Такого участника нет');
}

/** Every connection with what the UI shows about it. The bank's holder id is not part of it. */
export async function listConnections(db: Db): Promise<ConnectionInfo[]> {
  const rs = await db.execute(
    `SELECT c.id, c.participant_id, c.provider, COUNT(a.id) AS accounts,
            MAX(s.oldest_synced_time) AS oldest, MIN(s.newest_synced_time) AS newest, MAX(s.last_sync_at) AS last_sync
     FROM connections c
     LEFT JOIN accounts a ON a.connection_id = c.id
     LEFT JOIN sync_state s ON s.account_id = a.id
     GROUP BY c.id ORDER BY c.id`,
  );
  const date = (v: unknown) => (v === null || v === undefined ? null : toKyivDate(Number(v)));
  return rs.rows.map((r) => ({
    id: Number(r.id),
    participantId: Number(r.participant_id),
    provider: parseProviderId(r.provider),
    accounts: Number(r.accounts),
    coveredFrom: date(r.oldest),
    coveredTo: date(r.newest),
    lastSyncAt: r.last_sync === null ? null : toKyivDateTime(Number(r.last_sync)),
  }));
}

export async function addConnection(db: Db, participantId: number, provider: ProviderId, nowSec: number): Promise<number> {
  const p = await db.execute({ sql: 'SELECT 1 FROM participants WHERE id = ?', args: [participantId] });
  if (p.rows.length === 0) throw new ConnectionError('Такого участника нет');
  const rs = await db.execute({
    sql: 'INSERT INTO connections (participant_id, provider, created_at) VALUES (?, ?, ?) RETURNING id',
    args: [participantId, parseProviderId(provider), nowSec],
  });
  return Number(rs.rows[0]?.id);
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
