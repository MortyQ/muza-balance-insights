// scope = personal | business. Priority:
//   1. scope_overrides by counter_name, or by the description when there is no counterparty
//      (treasury and MCC 9311/9399 payments have none) — exceptions, e.g. a personal fine paid to the treasury;
//   2. a business account (the provider's rule; Monobank: type fop) → business;
//   3. treasury payment (the provider's rule; Monobank: «ГУК…») from any card → business, if the setting
//      treasury_business is on (default);
//   4. everything else → personal (incl. MCC 9311/9399 from personal cards).
// A refund paired with its purchase (refund_pair_id, credit side) takes the purchase's scope, like the category.
// Internal transfers get a scope too, but they never count as spending in either scope.
import { CATEGORY, matchOverride } from './categories.ts';
import type { Db, Stmt } from './db.ts';
import { accountProviders, providerOf } from './connections.ts';
import { rulesFor } from './providers/rules.ts';
import type { ProviderId } from './providers/types.ts';
import { getSettings, type Settings } from './settings.ts';
import type { TimeRange } from './transfers.ts';

export const SCOPES = ['personal', 'business'] as const;
export type Scope = (typeof SCOPES)[number];

export type MatchType = 'exact' | 'contains';
export type ScopeOverride = { pattern: string; matchType: MatchType; scope: Scope };

export type ScopeInput = {
  accountType: string | null;
  description: string;
  counterName: string | null;
  /** Whose rules apply (the account's connection's provider). */
  provider: ProviderId;
};

export function computeScope(
  tx: ScopeInput,
  overrides: readonly ScopeOverride[],
  settings: Pick<Settings, 'treasury_business'>,
): Scope {
  const override = matchOverride(overrideKey(tx), overrides);
  if (override) return override.scope;
  const rules = rulesFor(tx.provider);
  if (rules.isBusinessAccount({ type: tx.accountType })) return 'business';
  if (settings.treasury_business && rules.isTreasury(tx.description)) return 'business';
  return 'personal';
}

/** What a scope override matches: counter_name, or the description when there is no counterparty. */
export function overrideKey(tx: Pick<ScopeInput, 'counterName' | 'description'>): string {
  return tx.counterName?.trim() ? tx.counterName : tx.description;
}

export function isScope(s: string): s is Scope {
  return (SCOPES as readonly string[]).includes(s);
}

export async function loadScopeOverrides(db: Db): Promise<ScopeOverride[]> {
  const rs = await db.execute('SELECT pattern, match_type, scope FROM scope_overrides');
  return rs.rows.map((r) => ({
    pattern: String(r.pattern),
    matchType: r.match_type === 'exact' ? 'exact' : 'contains',
    scope: r.scope === 'business' ? 'business' : 'personal',
  }));
}

/** Recomputes scope for rows in the range (all rows if none). Writes only rows that change; returns their count. */
export async function rescope(db: Db, range?: TimeRange | null): Promise<number> {
  const [overrides, settings, providers] = await Promise.all([loadScopeOverrides(db), getSettings(db), accountProviders(db)]);
  const cols = `t.id, t.account_id, t.description, t.counter_name, t.amount, t.refund_pair_id, t.scope, a.type AS account_type`;
  const from = 'transactions t JOIN accounts a ON a.id = t.account_id';
  const rs = range
    ? await db.execute({ sql: `SELECT ${cols} FROM ${from} WHERE t.time BETWEEN ? AND ?`, args: [range.from, range.to] })
    : await db.execute(`SELECT ${cols} FROM ${from}`);

  const computed = new Map<string, Scope>();
  for (const r of rs.rows) {
    computed.set(
      String(r.id),
      computeScope(
        {
          accountType: r.account_type === null ? null : String(r.account_type),
          description: String(r.description ?? ''),
          counterName: r.counter_name === null ? null : String(r.counter_name),
          provider: providerOf(providers, String(r.account_id)),
        },
        overrides,
        settings,
      ),
    );
  }

  // Refund credits: the purchase's scope (computed above, or stored if the purchase is outside the range).
  const refunds = rs.rows.filter((r) => r.refund_pair_id !== null && Number(r.amount) > 0);
  const outside = refunds.map((r) => String(r.refund_pair_id)).filter((id) => !computed.has(id));
  const stored = new Map<string, Scope>();
  if (outside.length > 0) {
    const ps = await db.execute({
      sql: `SELECT id, scope FROM transactions WHERE id IN (${outside.map(() => '?').join(', ')})`,
      args: outside,
    });
    for (const r of ps.rows) stored.set(String(r.id), r.scope === 'business' ? 'business' : 'personal');
  }
  for (const r of refunds) {
    const purchase = String(r.refund_pair_id);
    const scope = computed.get(purchase) ?? stored.get(purchase);
    if (scope) computed.set(String(r.id), scope);
  }

  const stmts: Stmt[] = [];
  for (const r of rs.rows) {
    const scope = computed.get(String(r.id));
    if (scope !== undefined && scope !== r.scope) {
      stmts.push({ sql: 'UPDATE transactions SET scope = ? WHERE id = ?', args: [scope, String(r.id)] });
    }
  }
  if (stmts.length > 0) await db.batch(stmts);
  return stmts.length;
}

/** Non-cancelled rows per scope (for the recategorize report). */
export async function scopeCounts(db: Db): Promise<Record<Scope, number>> {
  const counts: Record<Scope, number> = { personal: 0, business: 0 };
  const rs = await db.execute('SELECT scope, COUNT(*) AS n FROM transactions WHERE is_cancelled = 0 GROUP BY scope');
  for (const r of rs.rows) if (isScope(String(r.scope))) counts[String(r.scope) as Scope] = Number(r.n);
  return counts;
}

// ---------- scope overrides (scripts/scope-overrides.ts, user only: real counterparty names) ----------

export class ScopeOverrideError extends Error {
  override name = 'ScopeOverrideError';
}

export type ScopeOverrideRow = ScopeOverride & { id: number };

export type ScopeCandidate = {
  /** counter_name, or the description when there is none — what an override would match. */
  key: string;
  scope: Scope;
  category: string;
  accountType: string | null;
  /** Account currency: amounts in different currencies are never summed. */
  currency: number;
  rows: number;
  /** Minor units, ≥ 0: total of debits. */
  total: number;
  lastDate: string;
};

/**
 * Debits on non-FOP cards that are business (the treasury rule) or look like taxes («налоги и госплатежи»,
 * incl. MCC 9311/9399) — where exceptions in either direction are likely. Grouped by override key,
 * per account currency, by total.
 */
export async function scopeOverrideCandidates(db: Db, limit = 30): Promise<ScopeCandidate[]> {
  const [accounts, providers] = await Promise.all([db.execute('SELECT id, type FROM accounts'), accountProviders(db)]);
  const business = accounts.rows
    .filter((r) => rulesFor(providerOf(providers, String(r.id))).isBusinessAccount({ type: r.type === null ? null : String(r.type) }))
    .map((r) => String(r.id));
  const notBusiness = business.length > 0 ? `AND a.id NOT IN (${business.map(() => '?').join(', ')})` : '';
  const rs = await db.execute({
    sql: `SELECT COALESCE(NULLIF(TRIM(t.counter_name), ''), TRIM(t.description)) AS k, t.scope, t.category,
                 a.type AS account_type, a.currency_code AS currency, COUNT(*) AS n,
                 SUM(-t.amount) AS total, MAX(t.local_date) AS last_date
          FROM transactions t JOIN accounts a ON a.id = t.account_id
          WHERE t.is_cancelled = 0 AND t.is_internal_transfer = 0 AND t.amount < 0
            ${notBusiness}
            AND (t.scope = 'business' OR t.category = ?)
          GROUP BY 1, 2, 3, 4, 5
          ORDER BY total DESC, k
          LIMIT ?`,
    args: [...business, CATEGORY.taxes, limit],
  });
  return rs.rows.map((r) => ({
    key: String(r.k),
    scope: r.scope === 'business' ? 'business' : 'personal',
    category: String(r.category),
    accountType: r.account_type === null ? null : String(r.account_type),
    currency: Number(r.currency),
    rows: Number(r.n),
    total: Number(r.total),
    lastDate: String(r.last_date),
  }));
}

export async function listScopeOverrides(db: Db): Promise<ScopeOverrideRow[]> {
  const rs = await db.execute('SELECT id, pattern, match_type, scope FROM scope_overrides ORDER BY id');
  return rs.rows.map((r) => ({
    id: Number(r.id),
    pattern: String(r.pattern),
    matchType: r.match_type === 'exact' ? 'exact' : 'contains',
    scope: r.scope === 'business' ? 'business' : 'personal',
  }));
}

/** Adds (or re-points) a scope override and re-scopes everything. Returns its id and how many rows changed. */
export async function addScopeOverride(
  db: Db,
  pattern: string,
  scope: string,
  matchType: MatchType = 'exact',
): Promise<{ id: number; changedRows: number }> {
  const p = pattern.trim();
  if (p === '') throw new ScopeOverrideError('Пустой шаблон');
  if (!isScope(scope)) throw new ScopeOverrideError(`Scope: ${SCOPES.join(' или ')}, получено «${scope}»`);
  if (matchType !== 'exact' && matchType !== 'contains') {
    throw new ScopeOverrideError(`Тип совпадения: exact или contains, получено «${String(matchType)}»`);
  }
  const rs = await db.execute({
    sql: `INSERT INTO scope_overrides (pattern, match_type, scope) VALUES (?, ?, ?)
          ON CONFLICT (pattern, match_type) DO UPDATE SET scope = excluded.scope
          RETURNING id`,
    args: [p, matchType, scope],
  });
  return { id: Number(rs.rows[0]?.id), changedRows: await rescope(db) };
}

export async function removeScopeOverride(db: Db, id: number): Promise<{ changedRows: number }> {
  const rs = await db.execute({ sql: 'DELETE FROM scope_overrides WHERE id = ?', args: [id] });
  if (rs.rowsAffected === 0) throw new ScopeOverrideError(`Scope-оверрайда с id ${id} нет`);
  return { changedRows: await rescope(db) };
}
