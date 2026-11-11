// Reserves: money the user keeps aside from what «Available per day» spreads over the days — a name of their own, an
// amount in a main currency (counted at today's rate by the app), an optional last day, whose it is (or common). Like recurring marks, they live
// in this database only: never an MCP tool, never the analysis copy.
import { APP_CURRENCY_CODES, type AppCurrency, isAppCurrency } from '../shared/currency.ts';
import type { Db } from '../storage/db.ts';

/** The largest amount: 100 million of the currency, minor units. */
export const RESERVE_AMOUNT_MAX = 10_000_000_000;
export const RESERVE_NAME_MAX = 60;
/** How many reserves there can be. */
export const RESERVES_MAX = 20;

export type ReserveInput = {
  name: string;
  currency: AppCurrency;
  /** Minor units of `currency`, 0 … RESERVE_AMOUNT_MAX. */
  amount: number;
  /** YYYY-MM-DD, the last day it counts; null — no end. */
  until: string | null;
  /** Whose it is: counted for that person and the family; null — common, counted for the family only. */
  participantId: number | null;
  /** Marked done (paid or no longer needed): listed, never taken off. Absent — kept as stored (a new one: not done). */
  done?: boolean;
};
export type Reserve = Omit<ReserveInput, 'done'> & { id: number; done: boolean };

export class ReserveError extends Error {
  override name = 'ReserveError';
}

/** A real calendar date in YYYY-MM-DD. */
function isDate(v: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

/** The input as stored (the name trimmed); an invalid one → ReserveError. */
function checked(r: ReserveInput): ReserveInput {
  const name = r.name.trim();
  if (name.length < 1 || [...name].length > RESERVE_NAME_MAX) throw new ReserveError(`name: 1 … ${RESERVE_NAME_MAX} characters`);
  if (!isAppCurrency(r.currency)) throw new ReserveError(`currency: ${APP_CURRENCY_CODES.join(' | ')}`);
  if (!Number.isInteger(r.amount) || r.amount < 0 || r.amount > RESERVE_AMOUNT_MAX) throw new ReserveError(`amount: 0 … ${RESERVE_AMOUNT_MAX}`);
  if (r.until !== null && !isDate(r.until)) throw new ReserveError('until: YYYY-MM-DD | null');
  if (r.participantId !== null && !Number.isInteger(r.participantId)) throw new ReserveError('participantId: an id | null');
  if (r.done !== undefined && typeof r.done !== 'boolean') throw new ReserveError('done: a boolean');
  return { name, currency: r.currency, amount: r.amount, until: r.until, participantId: r.participantId, done: r.done };
}

/** The input checked against the database too: an unknown person → ReserveError. */
async function stored(db: Db, input: ReserveInput): Promise<ReserveInput> {
  const r = checked(input);
  if (r.participantId !== null) {
    const rs = await db.execute({ sql: 'SELECT 1 FROM participants WHERE id = ?', args: [r.participantId] });
    if (rs.rows.length === 0) throw new ReserveError('unknown participant');
  }
  return r;
}

const reserveOf = (r: Record<string, unknown>): Reserve => ({
  id: Number(r.id),
  name: String(r.name),
  currency: Number(r.currency) as AppCurrency,
  amount: Number(r.amount),
  until: r.until === null || r.until === undefined ? null : String(r.until),
  participantId: r.participant_id === null || r.participant_id === undefined ? null : Number(r.participant_id),
  done: r.done_at !== null && r.done_at !== undefined,
});

const COLUMNS = 'id, name, currency, amount, until, participant_id, done_at';

/** Every reserve, oldest first. */
export async function listReserves(db: Db): Promise<Reserve[]> {
  const rs = await db.execute(`SELECT ${COLUMNS} FROM reserves ORDER BY id`);
  return rs.rows.map(reserveOf);
}

/** Adds a reserve; past RESERVES_MAX, an unknown person or an invalid one → ReserveError. */
export async function addReserve(db: Db, input: ReserveInput, nowSec: number): Promise<Reserve> {
  const r = await stored(db, input);
  const n = Number((await db.execute('SELECT COUNT(*) AS n FROM reserves')).rows[0]?.n ?? 0);
  if (n >= RESERVES_MAX) throw new ReserveError(`at most ${RESERVES_MAX} reserves`);
  const rs = await db.execute({
    sql: `INSERT INTO reserves (name, currency, amount, until, participant_id, created_at, done_at) VALUES (?, ?, ?, ?, ?, ?, ?)
          RETURNING ${COLUMNS}`,
    args: [r.name, r.currency, r.amount, r.until, r.participantId, nowSec, r.done === true ? nowSec : null],
  });
  return reserveOf(rs.rows[0]!);
}

/**
 * Replaces a reserve's fields; an unknown id, an unknown person or an invalid input → ReserveError. `done`: true marks
 * it done at `nowSec` (one already done keeps its moment), false makes it active again, absent leaves it as it is.
 */
export async function updateReserve(db: Db, id: number, input: ReserveInput, nowSec: number): Promise<Reserve> {
  const r = await stored(db, input);
  const done = r.done === undefined ? null : r.done ? 1 : 0;
  const rs = await db.execute({
    sql: `UPDATE reserves SET name = ?, currency = ?, amount = ?, until = ?, participant_id = ?,
            done_at = CASE ? WHEN 1 THEN COALESCE(done_at, ?) WHEN 0 THEN NULL ELSE done_at END
          WHERE id = ? RETURNING ${COLUMNS}`,
    args: [r.name, r.currency, r.amount, r.until, r.participantId, done, nowSec, id],
  });
  const row = rs.rows[0];
  if (row === undefined) throw new ReserveError('unknown reserve');
  return reserveOf(row);
}

/** Deletes a reserve; an unknown id → ReserveError. */
export async function deleteReserve(db: Db, id: number): Promise<void> {
  const rs = await db.execute({ sql: 'DELETE FROM reserves WHERE id = ? RETURNING id', args: [id] });
  if (rs.rows.length === 0) throw new ReserveError('unknown reserve');
}
