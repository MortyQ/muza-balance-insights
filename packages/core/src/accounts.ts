// The per-account toggle (migration v11, accounts.sync_choice): NULL = auto, 1 = on, 0 = off. A disabled account is
// not imported and is in no statistic; its rows stay in the database and count again as soon as it is enabled.
// A transfer between an enabled account and a disabled one is not internal (and not family): the disabled account is
// someone else's, so the row is an ordinary operation — decided at query time, the stored marks are not changed.
import { categorize, loadOverrides } from './categories.ts';
import { ConnectionError, accountProviders, providerOf } from './connections.ts';
import type { Db } from './db.ts';

/** SQL: the auto rule for account alias `a` — a card always; a jar with money or already imported (has coverage). */
function autoEnabledSql(a: string): string {
  return `(${a}.kind = 'card' OR ${a}.balance > 0 OR EXISTS (SELECT 1 FROM sync_state es WHERE es.account_id = ${a}.id))`;
}

/** SQL (1 / 0): account alias `a` is enabled — the user's choice, else the auto rule. The one definition for the core. */
export function accountEnabledSql(a: string): string {
  return `COALESCE(${a}.sync_choice, ${autoEnabledSql(a)})`;
}

/** SQL: ids of the enabled accounts, for `… account_id IN (…)`. */
export const ENABLED_ACCOUNT_IDS_SQL = `SELECT ea.id FROM accounts ea WHERE ${accountEnabledSql('ea')}`;

/**
 * SQL: row alias `t` is a transfer whose other side is on a disabled account — the row of its pair, or, for a single-row
 * IBAN match (iban / family), the account with that IBAN. Unpaired transfers (text) are not caught: their other side is
 * unknown.
 */
export function crossesDisabledSql(t: string): string {
  return `(${t}.transfer_rule IS NOT NULL AND (
    EXISTS (SELECT 1 FROM transactions pt WHERE pt.id = ${t}.transfer_pair_id AND pt.account_id NOT IN (${ENABLED_ACCOUNT_IDS_SQL}))
    OR (${t}.transfer_pair_id IS NULL AND ${t}.counter_iban IS NOT NULL AND EXISTS (
      SELECT 1 FROM accounts ia WHERE ia.iban IS NOT NULL
        AND UPPER(REPLACE(ia.iban, ' ', '')) = UPPER(REPLACE(${t}.counter_iban, ' ', '')) AND NOT ${accountEnabledSql('ia')}))))`;
}

/**
 * Non-cancelled rows of enabled accounts with local_date in [from, to] that cross to a disabled account, with the
 * category they get as ordinary operations (overrides, the provider's hint, MCC — as without the transfer mark). JSON
 * {id: category} for `LEFT JOIN json_each(?) x ON x.key = t.id`: `x.key IS NOT NULL` = crossing, `COALESCE(x.value,
 * t.category)` = the category to count. One argument whatever the number of rows.
 */
export async function crossingCategories(db: Db, range: { from: string; to: string }): Promise<string> {
  const rs = await db.execute({
    sql: `SELECT t.id, t.account_id, t.description, t.mcc, t.amount, t.counter_name FROM transactions t
          WHERE t.is_cancelled = 0 AND t.local_date BETWEEN ? AND ? AND t.account_id IN (${ENABLED_ACCOUNT_IDS_SQL})
            AND ${crossesDisabledSql('t')}`,
    args: [range.from, range.to],
  });
  if (rs.rows.length === 0) return '{}';
  const [overrides, providers] = await Promise.all([loadOverrides(db), accountProviders(db)]);
  const out: Record<string, string> = {};
  for (const r of rs.rows) {
    out[String(r.id)] = categorize(
      {
        description: String(r.description ?? ''),
        mcc: Number(r.mcc),
        amount: Number(r.amount),
        counterName: r.counter_name === null ? null : String(r.counter_name),
        isInternalTransfer: false,
        isFamilyTransfer: false,
        provider: providerOf(providers, String(r.account_id)),
      },
      overrides,
    );
  }
  return JSON.stringify(out);
}

export type ConnectionAccount = {
  id: string;
  kind: 'card' | 'jar';
  /** The provider's account type (Monobank: black / white / fop …); null for jars. */
  type: string | null;
  currencyCode: number;
  /** Last 4 digits of the card number; null for jars or when the bank sent none. */
  maskedPanTail: string | null;
  /** A jar's title; null for cards. */
  jarTitle: string | null;
  enabled: boolean;
  /** true = no choice made: `enabled` comes from the auto rule. */
  auto: boolean;
};

function panTail(maskedPan: unknown): string | null {
  if (typeof maskedPan !== 'string') return null;
  try {
    const pans: unknown = JSON.parse(maskedPan);
    const first = Array.isArray(pans) ? pans[0] : undefined;
    return typeof first === 'string' ? (/(\d{4})$/.exec(first)?.[1] ?? null) : null;
  } catch {
    return null;
  }
}

/** A connection's accounts for the toggle list, cards first. Never the IBAN or the full card number. */
export async function listConnectionAccounts(db: Db, connectionId: number): Promise<ConnectionAccount[]> {
  const rs = await db.execute({
    sql: `SELECT a.id, a.kind, a.type, a.currency_code, a.masked_pan, a.title, a.sync_choice, ${accountEnabledSql('a')} AS enabled
          FROM accounts a WHERE a.connection_id = ? ORDER BY a.kind = 'jar', a.id`,
    args: [connectionId],
  });
  return rs.rows.map((r) => {
    const jar = r.kind === 'jar';
    return {
      id: String(r.id),
      kind: jar ? 'jar' : 'card',
      type: r.type === null ? null : String(r.type),
      currencyCode: Number(r.currency_code),
      maskedPanTail: jar ? null : panTail(r.masked_pan),
      jarTitle: jar && r.title !== null ? String(r.title) : null,
      enabled: Number(r.enabled) === 1,
      auto: r.sync_choice === null,
    };
  });
}

/** The user's choice for one account; it stays until changed (the bank's sync keeps it). Unknown account → ConnectionError. */
export async function setAccountEnabled(db: Db, accountId: string, enabled: boolean): Promise<void> {
  const rs = await db.execute({
    sql: 'UPDATE accounts SET sync_choice = ? WHERE id = ? RETURNING id',
    args: [enabled ? 1 : 0, accountId],
  });
  if (rs.rows.length === 0) throw new ConnectionError('Такого счёта нет');
}
