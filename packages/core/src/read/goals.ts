// The user's plans (goals, goal_fixed — v20): category limits, the monthly budget with its own fixed costs, savings
// goals. Plain writes like reserves.ts: nothing derived depends on them, every read counts them at query time. The
// checks here come before the table's: a refused plan stores nothing.
import type { Db } from '../storage/db.ts';
import { DEFAULT_KINDS } from './category-kinds.ts';
import { LIMIT_PERIODS, type LimitPeriod } from './limits.ts';
import { RESERVE_AMOUNT_MAX, RESERVE_CURRENCIES, type ReserveCurrency } from './reserves.ts';

export const GOAL_NAME_MAX = 60;
/** How many limits (the budget included) and savings goals there can be. */
export const LIMITS_MAX = 50;
export const SAVINGS_MAX = 20;

type Owner = { currency: ReserveCurrency; amount: number; participantId: number | null };
export type LimitInput = Owner & { type: 'limit'; category: string; period: LimitPeriod };
export type BudgetInput = Owner & { type: 'budget'; fixed: Array<{ category: string; amount: number }> };
export type SavingInput = Owner & { type: 'saving'; name: string; until: string | null; source: 'jar' | 'own'; accountId: string | null };
export type GoalInput = LimitInput | BudgetInput | SavingInput;
export type Goal = GoalInput & { id: number };

export class GoalError extends Error {
  override name = 'GoalError';
}

function isDate(v: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

const amountOk = (n: number) => Number.isInteger(n) && n > 0 && n <= RESERVE_AMOUNT_MAX;

/** The input as stored (a name trimmed); an invalid one → GoalError. */
function checked(g: GoalInput): GoalInput {
  if (!RESERVE_CURRENCIES.includes(g.currency)) throw new GoalError(`currency: ${RESERVE_CURRENCIES.join(' | ')}`);
  if (!amountOk(g.amount)) throw new GoalError(`amount: 1 … ${RESERVE_AMOUNT_MAX}`);
  if (g.participantId !== null && !Number.isInteger(g.participantId)) throw new GoalError('participantId: an id | null');
  switch (g.type) {
    case 'limit':
      if (!DEFAULT_KINDS.has(g.category)) throw new GoalError('not a spending category');
      if (!LIMIT_PERIODS.includes(g.period)) throw new GoalError(`period: ${LIMIT_PERIODS.join(' | ')}`);
      return { ...g };
    case 'budget': {
      const seen = new Set<string>();
      for (const r of g.fixed) {
        if (!DEFAULT_KINDS.has(r.category)) throw new GoalError('fixed: not a spending category');
        if (seen.has(r.category)) throw new GoalError('fixed: a category once');
        if (!amountOk(r.amount)) throw new GoalError('fixed: an amount for every row');
        seen.add(r.category);
      }
      return { ...g, fixed: g.fixed.map((r) => ({ ...r })) };
    }
    case 'saving': {
      const name = g.name.trim();
      if (name.length < 1 || [...name].length > GOAL_NAME_MAX) throw new GoalError(`name: 1 … ${GOAL_NAME_MAX} characters`);
      if (g.until !== null && !isDate(g.until)) throw new GoalError('until: YYYY-MM-DD | null');
      if (g.source !== 'jar' && g.source !== 'own') throw new GoalError('source: jar | own');
      if (g.source === 'jar' && !g.accountId) throw new GoalError('a jar for a jar goal');
      return { ...g, name, accountId: g.source === 'jar' ? g.accountId : null };
    }
  }
}

/** Checked against the database too: an unknown person or jar, past the limits, a second limit of a kind → GoalError. */
async function stored(db: Db, input: GoalInput, id: number | null): Promise<GoalInput> {
  const g = checked(input);
  if (g.participantId !== null) {
    const rs = await db.execute({ sql: 'SELECT 1 FROM participants WHERE id = ?', args: [g.participantId] });
    if (rs.rows.length === 0) throw new GoalError('unknown participant');
  }
  if (g.type === 'saving' && g.source === 'jar') {
    const rs = await db.execute({ sql: `SELECT 1 FROM accounts WHERE id = ? AND kind = 'jar'`, args: [g.accountId] });
    if (rs.rows.length === 0) throw new GoalError('unknown jar');
  }
  const kinds = g.type === 'saving' ? `type = 'saving'` : `type IN ('limit', 'budget')`;
  const n = Number((await db.execute({ sql: `SELECT COUNT(*) AS n FROM goals WHERE ${kinds} AND id IS NOT ?`, args: [id] })).rows[0]?.n ?? 0);
  if (n >= (g.type === 'saving' ? SAVINGS_MAX : LIMITS_MAX)) throw new GoalError('too many');
  if (g.type !== 'saving') {
    const rs = await db.execute({
      sql: `SELECT 1 FROM goals WHERE type = ? AND ifnull(category, '') = ? AND period IS ? AND ifnull(participant_id, 0) = ? AND id IS NOT ?`,
      args: [g.type, g.type === 'limit' ? g.category : '', g.type === 'limit' ? g.period : 'month', g.participantId ?? 0, id],
    });
    if (rs.rows.length > 0) throw new GoalError(g.type === 'budget' ? 'one budget per owner' : 'one limit per category, period and owner');
  }
  return g;
}

function columns(g: GoalInput): Array<string | number | null> {
  return [
    g.type,
    g.type === 'limit' ? g.category : null,
    g.type === 'limit' ? g.period : g.type === 'budget' ? 'month' : null,
    g.currency,
    g.amount,
    g.participantId,
    g.type === 'saving' ? g.name : null,
    g.type === 'saving' ? g.until : null,
    g.type === 'saving' ? g.source : null,
    g.type === 'saving' ? g.accountId : null,
  ];
}

async function writeFixed(db: Db, id: number, g: GoalInput): Promise<void> {
  await db.execute({ sql: 'DELETE FROM goal_fixed WHERE goal_id = ?', args: [id] });
  if (g.type !== 'budget') return;
  for (const r of g.fixed) await db.execute({ sql: 'INSERT INTO goal_fixed (goal_id, category, amount) VALUES (?, ?, ?)', args: [id, r.category, r.amount] });
}

/** Adds a plan; an invalid or a second one → GoalError, nothing stored. */
export async function addGoal(db: Db, input: GoalInput, nowSec: number): Promise<Goal> {
  const g = await stored(db, input, null);
  const rs = await db.execute({
    sql: `INSERT INTO goals (type, category, period, currency, amount, participant_id, name, until, source, account_id, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
    args: [...columns(g), nowSec],
  });
  const id = Number(rs.rows[0]?.id);
  await writeFixed(db, id, g);
  return { ...g, id };
}

/** Replaces a plan (its type stays); an unknown id or an invalid input → GoalError. */
export async function updateGoal(db: Db, id: number, input: GoalInput): Promise<Goal> {
  const was = await db.execute({ sql: 'SELECT type FROM goals WHERE id = ?', args: [id] });
  if (was.rows.length === 0) throw new GoalError('unknown goal');
  if (String(was.rows[0]!.type) !== input.type) throw new GoalError('a goal keeps its type');
  const g = await stored(db, input, id);
  await db.execute({
    sql: `UPDATE goals SET type = ?, category = ?, period = ?, currency = ?, amount = ?, participant_id = ?, name = ?, until = ?,
          source = ?, account_id = ? WHERE id = ?`,
    args: [...columns(g), id],
  });
  await writeFixed(db, id, g);
  return { ...g, id };
}

/** Deletes a plan with its fixed rows; an unknown id → GoalError. */
export async function deleteGoal(db: Db, id: number): Promise<void> {
  await db.execute({ sql: 'DELETE FROM goal_fixed WHERE goal_id = ?', args: [id] });
  const rs = await db.execute({ sql: 'DELETE FROM goals WHERE id = ? RETURNING id', args: [id] });
  if (rs.rows.length === 0) throw new GoalError('unknown goal');
}

/** Every plan, oldest first, the budget's fixed rows in their order of entry. */
export async function listGoals(db: Db): Promise<Goal[]> {
  const rs = await db.execute('SELECT id, type, category, period, currency, amount, participant_id, name, until, source, account_id FROM goals ORDER BY id');
  const fixed = await db.execute('SELECT goal_id, category, amount FROM goal_fixed ORDER BY rowid');
  const rowsOf = (id: number) => fixed.rows.filter((r) => Number(r.goal_id) === id).map((r) => ({ category: String(r.category), amount: Number(r.amount) }));
  return rs.rows.map((r): Goal => {
    const base = { id: Number(r.id), currency: Number(r.currency) as ReserveCurrency, amount: Number(r.amount), participantId: r.participant_id === null ? null : Number(r.participant_id) };
    if (r.type === 'limit') return { ...base, type: 'limit', category: String(r.category), period: String(r.period) as LimitPeriod };
    if (r.type === 'budget') return { ...base, type: 'budget', fixed: rowsOf(base.id) };
    return {
      ...base,
      type: 'saving',
      name: String(r.name),
      until: r.until === null ? null : String(r.until),
      source: String(r.source) as 'jar' | 'own',
      accountId: r.account_id === null ? null : String(r.account_id),
    };
  });
}
