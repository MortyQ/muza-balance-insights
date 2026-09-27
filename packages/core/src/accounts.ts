// The per-account toggle (migration v11, accounts.sync_choice): NULL = auto, 1 = on, 0 = off. A disabled account is
// not imported and is in no statistic; its rows stay in the database and count again as soon as it is enabled.
// A transfer between an enabled account and a disabled one is not internal (and not family): the disabled account is
// someone else's, so the row is an ordinary operation — decided at query time, the stored marks are not changed.
import { categorize, loadOverrides } from './categories.ts';
import { ConnectionError, accountProviders, providerOf } from './connections.ts';
import type { Db } from './db.ts';
import { rulesFor } from './providers/rules.ts';

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
 * IBAN match (iban / family), the account with that IBAN. Single-row own-transfer texts (`text`) are decided in JS by
 * the provider's rule (crossingCategories); fx rates never use such rows.
 */
export function crossesDisabledSql(t: string): string {
  return `(${t}.transfer_rule IS NOT NULL AND (
    EXISTS (SELECT 1 FROM transactions pt WHERE pt.id = ${t}.transfer_pair_id AND pt.account_id NOT IN (${ENABLED_ACCOUNT_IDS_SQL}))
    OR (${t}.transfer_pair_id IS NULL AND TRIM(COALESCE(${t}.counter_iban, '')) <> '' AND EXISTS (
      SELECT 1 FROM accounts ia WHERE TRIM(COALESCE(ia.iban, '')) <> ''
        AND UPPER(REPLACE(ia.iban, ' ', '')) = UPPER(REPLACE(${t}.counter_iban, ' ', '')) AND NOT ${accountEnabledSql('ia')}))))`;
}

/**
 * The crossing rows of a statistic's query, as its first CTE and a join (one `?`: the JSON of crossingCategories).
 * MATERIALIZED: a plain `json_each` join is re-scanned for every row.
 */
export const CROSSING_CTE = 'crossing AS MATERIALIZED (SELECT key, value FROM json_each(?))';
export const CROSSING_JOIN = 'LEFT JOIN crossing x ON x.key = t.id';

type TextRow = { id: string; accountId: string; description: string; mcc: number; amount: number; counterName: string | null };

/**
 * Non-cancelled rows of enabled accounts with local_date in [from, to] that cross to a disabled account, with the
 * category they get as ordinary operations (overrides, the provider's hint, MCC — as without the transfer mark). JSON
 * {id: category} for CROSSING_CTE / CROSSING_JOIN: `x.key IS NOT NULL` = crossing, `COALESCE(x.value, t.category)` =
 * the category to count. One argument whatever the number of rows.
 * Crossing: crossesDisabledSql, or a single-row own-transfer text (`text`: a transfer made after the other side was
 * turned off has no pair) whose other side, as the provider reads the text, is only disabled accounts of the same
 * connection. A text that names nothing, or fits an enabled account too, stays internal.
 */
export async function crossingCategories(db: Db, range: { from: string; to: string }): Promise<string> {
  const cols = 't.id, t.account_id, t.description, t.mcc, t.amount, t.counter_name';
  const inRange = `t.is_cancelled = 0 AND t.local_date BETWEEN ? AND ? AND t.account_id IN (${ENABLED_ACCOUNT_IDS_SQL})`;
  const paired = await db.execute({ sql: `SELECT ${cols} FROM transactions t WHERE ${inRange} AND ${crossesDisabledSql('t')}`, args: [range.from, range.to] });
  const found = paired.rows.map(textRow);
  found.push(...(await crossingTexts(db, range, cols, inRange)));
  if (found.length === 0) return '{}';
  const [overrides, providers] = await Promise.all([loadOverrides(db), accountProviders(db)]);
  const out: Record<string, string> = {};
  for (const r of found) {
    out[r.id] = categorize(
      {
        description: r.description,
        mcc: r.mcc,
        amount: r.amount,
        counterName: r.counterName,
        isInternalTransfer: false,
        isFamilyTransfer: false,
        provider: providerOf(providers, r.accountId),
      },
      overrides,
    );
  }
  return JSON.stringify(out);
}

function textRow(r: Record<string, unknown>): TextRow {
  return {
    id: String(r.id),
    accountId: String(r.account_id),
    description: String(r.description ?? ''),
    mcc: Number(r.mcc),
    amount: Number(r.amount),
    counterName: r.counter_name === null || r.counter_name === undefined ? null : String(r.counter_name),
  };
}

async function crossingTexts(db: Db, range: { from: string; to: string }, cols: string, inRange: string): Promise<TextRow[]> {
  const acc = await db.execute(`SELECT a.id, a.connection_id, a.kind, a.type, a.currency_code, a.title, ${accountEnabledSql('a')} AS enabled FROM accounts a`);
  const accounts = acc.rows.map((r) => ({
    id: String(r.id),
    connectionId: Number(r.connection_id),
    kind: String(r.kind),
    type: r.type === null ? null : String(r.type),
    currencyCode: Number(r.currency_code),
    title: r.title === null ? null : String(r.title).trim(),
    enabled: Number(r.enabled) === 1,
  }));
  if (accounts.every((a) => a.enabled)) return [];
  const rs = await db.execute({
    sql: `SELECT ${cols} FROM transactions t WHERE ${inRange} AND t.transfer_rule = 'text' AND t.transfer_pair_id IS NULL`,
    args: [range.from, range.to],
  });
  if (rs.rows.length === 0) return [];
  const providers = await accountProviders(db);
  const byId = new Map(accounts.map((a) => [a.id, a]));
  const out: TextRow[] = [];
  for (const r of rs.rows.map(textRow)) {
    const own = byId.get(r.accountId);
    if (!own) continue;
    const siblings = accounts.filter((a) => a.connectionId === own.connectionId && a.id !== own.id);
    const jarTitles = new Set(siblings.filter((a) => a.kind === 'jar' && a.title).map((a) => a.title as string));
    const other = rulesFor(providerOf(providers, r.accountId)).ownTransferCounterpart(r, { jarTitles });
    if (other === null) continue;
    const candidates = siblings.filter((a) =>
      other.kind === 'jar'
        ? a.kind === 'jar' && a.title === other.title
        : a.kind === 'card' && a.type === other.type && (other.currencyCode === null || a.currencyCode === other.currencyCode),
    );
    if (candidates.length > 0 && candidates.every((a) => !a.enabled)) out.push(r);
  }
  return out;
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
