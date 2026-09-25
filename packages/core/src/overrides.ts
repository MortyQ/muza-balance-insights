// Category overrides by counter_name (table category_overrides). Used by scripts/overrides.ts,
// which only the user runs: candidates show real counterparty names and never go to the analysis copy.
import { CATEGORY, recategorize } from './categories.ts';
import type { Db } from './db.ts';

export type MatchType = 'exact' | 'contains';

/** Categories an override may assign: every row category except the derived ones. */
export const OVERRIDE_CATEGORIES: readonly string[] = Object.values(CATEGORY).filter(
  (c) => c !== CATEGORY.ownTransfers && c !== CATEGORY.fees,
);

export class OverrideError extends Error {
  override name = 'OverrideError';
}

export type OverrideCandidate = {
  counterName: string;
  /** Account currency: amounts in different currencies are never summed. */
  currency: number;
  rows: number;
  /** Minor units, ≥ 0. */
  total: number;
  lastDate: string;
};

/** Top counterparties in «переводы людям» by total, all history, per account currency. */
export async function overrideCandidates(db: Db, limit = 30): Promise<OverrideCandidate[]> {
  const rs = await db.execute({
    sql: `SELECT TRIM(t.counter_name) AS name, a.currency_code AS currency, COUNT(*) AS n,
                 SUM(-t.amount) AS total, MAX(t.local_date) AS last_date
          FROM transactions t JOIN accounts a ON a.id = t.account_id
          WHERE t.is_cancelled = 0 AND t.is_internal_transfer = 0 AND t.category = ?
            AND t.counter_name IS NOT NULL AND TRIM(t.counter_name) <> ''
          GROUP BY 1, 2
          ORDER BY total DESC, name
          LIMIT ?`,
    args: [CATEGORY.p2p, limit],
  });
  return rs.rows.map((r) => ({
    counterName: String(r.name),
    currency: Number(r.currency),
    rows: Number(r.n),
    total: Number(r.total),
    lastDate: String(r.last_date),
  }));
}

export type OverrideRow = { id: number; pattern: string; matchType: MatchType; category: string };

export async function listOverrides(db: Db): Promise<OverrideRow[]> {
  const rs = await db.execute('SELECT id, pattern, match_type, category FROM category_overrides ORDER BY id');
  return rs.rows.map((r) => ({
    id: Number(r.id),
    pattern: String(r.pattern),
    matchType: r.match_type === 'exact' ? 'exact' : 'contains',
    category: String(r.category),
  }));
}

/**
 * Adds (or re-points) an override and re-categorizes everything. Same pattern + match type → category updated.
 * Returns the override id and how many rows changed category.
 */
export async function addOverride(
  db: Db,
  pattern: string,
  category: string,
  matchType: MatchType = 'exact',
): Promise<{ id: number; changedRows: number }> {
  const p = pattern.trim();
  if (p === '') throw new OverrideError('Пустой шаблон');
  if (!OVERRIDE_CATEGORIES.includes(category)) {
    throw new OverrideError(`Неизвестная категория «${category}». Допустимые: ${OVERRIDE_CATEGORIES.join(', ')}`);
  }
  if (matchType !== 'exact' && matchType !== 'contains') {
    throw new OverrideError(`Тип совпадения: exact или contains, получено «${String(matchType)}»`);
  }
  const rs = await db.execute({
    sql: `INSERT INTO category_overrides (pattern, match_type, category) VALUES (?, ?, ?)
          ON CONFLICT (pattern, match_type) DO UPDATE SET category = excluded.category
          RETURNING id`,
    args: [p, matchType, category],
  });
  const changedRows = await recategorize(db);
  return { id: Number(rs.rows[0]?.id), changedRows };
}

export async function removeOverride(db: Db, id: number): Promise<{ changedRows: number }> {
  const rs = await db.execute({ sql: 'DELETE FROM category_overrides WHERE id = ?', args: [id] });
  if (rs.rowsAffected === 0) throw new OverrideError(`Оверрайда с id ${id} нет`);
  return { changedRows: await recategorize(db) };
}
