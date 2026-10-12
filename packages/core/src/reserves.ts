// Reserves: money the user keeps aside from what «Available per day» spreads over the days — a name of their own, an
// amount in a main currency (counted at today's rate by the app), an optional last day, whose it is (or common). Like recurring marks, they live
// in this database only: never an MCP tool, never the analysis copy.
import type { Db } from './db.ts';

/** The currencies a reserve is kept in: hryvnia, dollar, euro. */
export const RESERVE_CURRENCIES = [980, 840, 978] as const;
export type ReserveCurrency = (typeof RESERVE_CURRENCIES)[number];
/** The largest amount: 100 million of the currency, minor units. */
export const RESERVE_AMOUNT_MAX = 10_000_000_000;
export const RESERVE_NAME_MAX = 60;
/** How many reserves there can be. */
export const RESERVES_MAX = 20;

export type ReserveInput = {
  name: string;
  currency: ReserveCurrency;
  /** Minor units of `currency`, 0 … RESERVE_AMOUNT_MAX. */
  amount: number;
  /** YYYY-MM-DD, the last day it counts; null — no end. */
  until: string | null;
  /** Whose it is: counted for that person and the family; null — common, counted for the family only. */
  participantId: number | null;
};
export type Reserve = ReserveInput & { id: number };

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
  if (!RESERVE_CURRENCIES.includes(r.currency)) throw new ReserveError(`currency: ${RESERVE_CURRENCIES.join(' | ')}`);
  if (!Number.isInteger(r.amount) || r.amount < 0 || r.amount > RESERVE_AMOUNT_MAX) throw new ReserveError(`amount: 0 … ${RESERVE_AMOUNT_MAX}`);
  if (r.until !== null && !isDate(r.until)) throw new ReserveError('until: YYYY-MM-DD | null');
  if (r.participantId !== null && !Number.isInteger(r.participantId)) throw new ReserveError('participantId: an id | null');
  return { name, currency: r.currency, amount: r.amount, until: r.until, participantId: r.participantId };
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
  currency: Number(r.currency) as ReserveCurrency,
  amount: Number(r.amount),
  until: r.until === null || r.until === undefined ? null : String(r.until),
  participantId: r.participant_id === null || r.participant_id === undefined ? null : Number(r.participant_id),
});

/** Every reserve, oldest first. */
export async function listReserves(db: Db): Promise<Reserve[]> {
  const rs = await db.execute('SELECT id, name, currency, amount, until, participant_id FROM reserves ORDER BY id');
  return rs.rows.map(reserveOf);
}

/** Adds a reserve; past RESERVES_MAX, an unknown person or an invalid one → ReserveError. */
export async function addReserve(db: Db, input: ReserveInput, nowSec: number): Promise<Reserve> {
  const r = await stored(db, input);
  const n = Number((await db.execute('SELECT COUNT(*) AS n FROM reserves')).rows[0]?.n ?? 0);
  if (n >= RESERVES_MAX) throw new ReserveError(`at most ${RESERVES_MAX} reserves`);
  const rs = await db.execute({
    sql: 'INSERT INTO reserves (name, currency, amount, until, participant_id, created_at) VALUES (?, ?, ?, ?, ?, ?) RETURNING id',
    args: [r.name, r.currency, r.amount, r.until, r.participantId, nowSec],
  });
  return { id: Number(rs.rows[0]?.id), ...r };
}

/** Replaces a reserve's fields; an unknown id, an unknown person or an invalid input → ReserveError. */
export async function updateReserve(db: Db, id: number, input: ReserveInput): Promise<Reserve> {
  const r = await stored(db, input);
  const rs = await db.execute({
    sql: 'UPDATE reserves SET name = ?, currency = ?, amount = ?, until = ?, participant_id = ? WHERE id = ? RETURNING id',
    args: [r.name, r.currency, r.amount, r.until, r.participantId, id],
  });
  if (rs.rows.length === 0) throw new ReserveError('unknown reserve');
  return { id, ...r };
}

/** Deletes a reserve; an unknown id → ReserveError. */
export async function deleteReserve(db: Db, id: number): Promise<void> {
  const rs = await db.execute({ sql: 'DELETE FROM reserves WHERE id = ? RETURNING id', args: [id] });
  if (rs.rows.length === 0) throw new ReserveError('unknown reserve');
}
