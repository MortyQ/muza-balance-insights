// Stored derived values that depend on the accounts, not on the row alone. Today: crossing (migration v16,
// transactions.crossing_category). A transfer between an enabled account and a disabled one is not internal (and not
// family): the disabled account is someone else's, so the row is an ordinary operation and gets the category it would
// get without the transfer mark. NULL = the row does not cross. The statistics read the column
// (`COALESCE(t.crossing_category, t.category)`, `t.crossing_category IS NULL`); only writers derive it:
// - range mode — the rows of a committed window's span (commitRows), after its transfer marks;
// - full mode — when the accounts' fingerprint changed (refreshCrossing), and at the end of rederiveCore.
import { ENABLED_ACCOUNT_IDS_SQL, accountEnabledSql } from '../people/accounts.ts';
import { categorize, loadOverrides } from './categories.ts';
import { accountProviders, providerOf } from '../people/connections.ts';
import type { Db, Stmt } from '../storage/db.ts';
import { rulesFor } from '../providers/rules.ts';
import { numOrNull, textOrNull } from '../shared/sql-values.ts';
import type { TimeRange } from './transfers.ts';

/** derived_state key of the accounts' fingerprint crossing was last derived for in full. */
const FINGERPRINT_KEY = 'crossing_accounts';

type Account = {
  id: string;
  connectionId: number;
  kind: string;
  type: string | null;
  currencyCode: number;
  title: string | null;
  iban: string | null;
  enabled: boolean;
};

async function readAccounts(db: Db): Promise<Account[]> {
  const rs = await db.execute(
    `SELECT a.id, a.connection_id, a.kind, a.type, a.currency_code, a.title, a.iban, ${accountEnabledSql('a')} AS enabled
     FROM accounts a ORDER BY a.id`,
  );
  return rs.rows.map((r) => ({
    id: String(r.id),
    connectionId: Number(r.connection_id),
    kind: String(r.kind),
    type: r.type === null ? null : String(r.type),
    currencyCode: Number(r.currency_code),
    title: r.title === null ? null : String(r.title).trim(),
    iban: r.iban === null ? null : String(r.iban),
    enabled: Number(r.enabled) === 1,
  }));
}

/** Everything about the accounts that crossing reads: who they are, what the rules match on, whether they count. */
const fingerprintOf = (accounts: readonly Account[]): string =>
  JSON.stringify(accounts.map((a) => [a.id, a.connectionId, a.kind, a.type, a.currencyCode, a.title, a.iban, a.enabled]));

/**
 * SQL: row alias `t` is a transfer whose other side is on a disabled account — the row of its pair, or, for a single-row
 * IBAN match (iban / family), the account with that IBAN. Single-row own-transfer texts (`text`) are decided in JS by
 * the provider's rule (crossingTexts).
 */
function crossesDisabledSql(t: string): string {
  return `(${t}.transfer_rule IS NOT NULL AND (
    EXISTS (SELECT 1 FROM transactions pt WHERE pt.id = ${t}.transfer_pair_id AND pt.account_id NOT IN (${ENABLED_ACCOUNT_IDS_SQL}))
    OR (${t}.transfer_pair_id IS NULL AND TRIM(COALESCE(${t}.counter_iban, '')) <> '' AND EXISTS (
      SELECT 1 FROM accounts ia WHERE TRIM(COALESCE(ia.iban, '')) <> ''
        AND UPPER(REPLACE(ia.iban, ' ', '')) = UPPER(REPLACE(${t}.counter_iban, ' ', '')) AND NOT ${accountEnabledSql('ia')}))))`;
}

type Row = { id: string; accountId: string; description: string; mcc: number | null; amount: number; bankCategory: string | null; counterName: string | null };

const COLS = 't.id, t.account_id, t.description, t.mcc, t.amount, t.bank_category, t.counter_name';

function toRow(r: Record<string, unknown>): Row {
  return {
    id: String(r.id),
    accountId: String(r.account_id),
    description: String(r.description ?? ''),
    mcc: numOrNull(r.mcc),
    amount: Number(r.amount),
    bankCategory: textOrNull(r.bank_category),
    counterName: r.counter_name === null || r.counter_name === undefined ? null : String(r.counter_name),
  };
}

const rangeSql = (range: TimeRange | null) => (range ? ' AND t.time BETWEEN ? AND ?' : '');
const rangeArgs = (range: TimeRange | null) => (range ? [range.from, range.to] : []);

/**
 * Single-row own-transfer texts (`text`: a transfer made after the other side was turned off has no pair) whose other
 * side, as the provider reads the text, is only disabled accounts of the same connection. A text that names nothing,
 * or fits an enabled account too, stays internal.
 */
async function crossingTexts(db: Db, accounts: readonly Account[], range: TimeRange | null): Promise<Row[]> {
  const rs = await db.execute({
    sql: `SELECT ${COLS} FROM transactions t
          WHERE t.account_id IN (${ENABLED_ACCOUNT_IDS_SQL}) AND t.transfer_rule = 'text' AND t.transfer_pair_id IS NULL${rangeSql(range)}`,
    args: rangeArgs(range),
  });
  if (rs.rows.length === 0) return [];
  const providers = await accountProviders(db);
  const byId = new Map(accounts.map((a) => [a.id, a]));
  const out: Row[] = [];
  for (const r of rs.rows.map(toRow)) {
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

/**
 * Derives crossing_category for the rows of enabled accounts in `range` (by `time`, inclusive), or for every row
 * (null): the ordinary category of a crossing row (overrides, the provider's hint, MCC — as without the transfer mark),
 * NULL otherwise. Writes only the rows whose value changes; returns their number.
 */
async function deriveCrossing(db: Db, accounts: readonly Account[], range: TimeRange | null): Promise<number> {
  const wanted = new Map<string, string>();
  if (accounts.some((a) => !a.enabled)) {
    const paired = await db.execute({
      sql: `SELECT ${COLS} FROM transactions t
            WHERE t.account_id IN (${ENABLED_ACCOUNT_IDS_SQL})${rangeSql(range)} AND ${crossesDisabledSql('t')}`,
      args: rangeArgs(range),
    });
    const found = [...paired.rows.map(toRow), ...(await crossingTexts(db, accounts, range))];
    if (found.length > 0) {
      const [overrides, providers] = await Promise.all([loadOverrides(db), accountProviders(db)]);
      for (const r of found) {
        wanted.set(
          r.id,
          categorize(
            {
              description: r.description,
              mcc: r.mcc,
              amount: r.amount,
              bankCategory: r.bankCategory,
              counterName: r.counterName,
              isInternalTransfer: false,
              isFamilyTransfer: false,
              provider: providerOf(providers, r.accountId),
            },
            overrides,
          ),
        );
      }
    }
  }

  const current = await db.execute({
    sql: `SELECT t.id, t.crossing_category FROM transactions t WHERE t.crossing_category IS NOT NULL${rangeSql(range)}`,
    args: rangeArgs(range),
  });
  const stmts: Stmt[] = [];
  const set = (id: string, value: string | null) =>
    stmts.push({ sql: 'UPDATE transactions SET crossing_category = ? WHERE id = ?', args: [value, id] });
  for (const r of current.rows) {
    const id = String(r.id);
    const want = wanted.get(id);
    if (want === undefined) set(id, null);
    else if (want !== String(r.crossing_category)) set(id, want);
    wanted.delete(id);
  }
  for (const [id, category] of wanted) set(id, category);
  if (stmts.length > 0) await db.batch(stmts);
  return stmts.length;
}

/** Full derivation over every row, and the fingerprint it was made for. rederiveCore's step; prints nothing. */
export async function rederiveCrossing(db: Db): Promise<number> {
  const accounts = await readAccounts(db);
  const changed = await deriveCrossing(db, accounts, null);
  await storeFingerprint(db, fingerprintOf(accounts));
  return changed;
}

async function storeFingerprint(db: Db, value: string): Promise<void> {
  await db.execute({
    sql: 'INSERT INTO derived_state (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    args: [FINGERPRINT_KEY, value],
  });
}

/**
 * Keeps crossing right after anything that may change the accounts (a toggle, the bank's account list, a window or a
 * statement commit, a removed connection, the first open after the migration). The accounts' fingerprint changed → a
 * full derivation; unchanged → only `range` if given (the rows a commit just wrote or re-marked), else nothing at all.
 * Every writer of `accounts` / `sync_state` calls it; readers never do.
 */
export async function refreshCrossing(db: Db, range: TimeRange | null = null): Promise<void> {
  const accounts = await readAccounts(db);
  const fingerprint = fingerprintOf(accounts);
  const stored = await db.execute({ sql: 'SELECT value FROM derived_state WHERE key = ?', args: [FINGERPRINT_KEY] });
  if (stored.rows[0]?.value !== fingerprint) {
    await deriveCrossing(db, accounts, null);
    await storeFingerprint(db, fingerprint);
  } else if (range) {
    await deriveCrossing(db, accounts, range);
  }
}

/**
 * What of the accounts can re-mark old rows outside any window: IBANs (the `iban` and `family` rules), jar titles (the
 * `text` rule) and card types (scope), one entry per account. Only compared (accountInputsChanged), never shown.
 */
export type AccountInputs = ReadonlyMap<string, string>;

export async function accountInputs(db: Db): Promise<AccountInputs> {
  const rs = await db.execute("SELECT id, iban, type, CASE WHEN kind = 'jar' THEN title END AS jar_title FROM accounts");
  return new Map(rs.rows.map((r) => [String(r.id), JSON.stringify([r.iban ?? null, r.type ?? null, r.jar_title ?? null])]));
}

/**
 * True when the import changed what old rows depend on: an existing account's IBAN, type or jar title, or a new account
 * bringing an IBAN or a jar title not seen before. A new account alone does not: its rows pair only inside its windows.
 */
export function accountInputsChanged(before: AccountInputs, after: AccountInputs): boolean {
  const known = new Set([...before.values()].flatMap((v) => {
    const [iban, , title] = JSON.parse(v) as [string | null, string | null, string | null];
    return [iban && `i:${iban}`, title && `t:${title}`].filter((x): x is string => !!x);
  }));
  for (const [id, v] of after) {
    const was = before.get(id);
    if (was !== undefined) {
      if (was !== v) return true;
      continue;
    }
    const [iban, , title] = JSON.parse(v) as [string | null, string | null, string | null];
    if ((iban && !known.has(`i:${iban}`)) || (title && !known.has(`t:${title}`))) return true;
  }
  return false;
}
