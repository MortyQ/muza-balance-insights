// The per-account toggle (migration v11, accounts.sync_choice): NULL = auto, 1 = on, 0 = off. A disabled account is
// not imported and is in no statistic; its rows stay in the database and count again as soon as it is enabled.
// A transfer between an enabled account and a disabled one is not internal (and not family): the disabled account is
// someone else's, so the row is an ordinary operation — stored as transactions.crossing_category (derived.ts).
import { ConnectionError } from './connections.ts';
import type { Db } from '../storage/db.ts';

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

/** SQL: `AND <c>.provider IN (?, …)` for `n` providers bound by the caller; '' for none. */
const providerInSql = (c: string, n: number) => (n === 0 ? '' : ` AND ${c}.provider IN (${Array.from({ length: n }, () => '?').join(', ')})`);

/** SQL: ids of the accounts of the given providers' connections, for `… account_id IN (…)`; args = the providers. */
export function providerAccountIdsSql(providers: readonly string[]): { sql: string; args: string[] } {
  return {
    sql: `SELECT pa.id FROM accounts pa JOIN connections pc ON pc.id = pa.connection_id WHERE 1${providerInSql('pc', providers.length)}`,
    args: [...providers],
  };
}

/**
 * The enabled accounts that decide how far the data reaches (spec desktop-data-freshness): those of token connections
 * while any of them has imported data — a statement file is a snapshot and never holds the others back — else every
 * enabled account. With providers (a bank view, spec core-bank-view) the same rule among those banks' accounts only.
 */
export function liveAccountIdsSql(providers: readonly string[] = []): { sql: string; args: string[] } {
  const n = providers.length;
  return {
    sql: `SELECT va.id FROM accounts va JOIN connections vc ON vc.id = va.connection_id
  WHERE ${accountEnabledSql('va')}${providerInSql('vc', n)} AND (vc.method = 'token' OR NOT EXISTS (
    SELECT 1 FROM accounts ta JOIN connections tc ON tc.id = ta.connection_id JOIN sync_state ts ON ts.account_id = ta.id
    WHERE tc.method = 'token' AND ts.newest_synced_time IS NOT NULL AND ${accountEnabledSql('ta')}${providerInSql('tc', n)}))`,
    args: [...providers, ...providers],
  };
}

/** liveAccountIdsSql over every bank: binds nothing. */
export const LIVE_ACCOUNT_IDS_SQL = liveAccountIdsSql().sql;

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
