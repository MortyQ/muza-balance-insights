// A statement file into a connection's accounts. Each statement (one account of the file) goes to an account: the
// caller's target, else the one matched by IBAN, else by a masked card number, else a new one. First each is compared
// with what its account already has (counts only); then every account of the file is written in one transaction, or
// none — the accounts (new, or their balance, IBAN and cards), the rows and the coverage — then the derivation passes
// over the file's span as for the API (a full pass only when that failed, or when the file brought an IBAN or a card
// number the connection's accounts did not have). Only accounts of a file connection are written; a token connection's
// account can be compared with a file (the reference check), never written from one.
import { ConnectionError, parseConnectionMethod, parseProviderId } from '../people/connections.ts';
import type { Db, Stmt } from '../storage/db.ts';
import { storedId } from '../providers/ids.ts';
import type { ParsedStatement, ProviderId } from '../providers/types.ts';
import { rederiveCore } from '../derive/rederive.ts';
import { deriveCommitted, prepareRows } from './commit.ts';
import { getSyncState, type Window } from './plan.ts';

/** Where a statement's rows go: an account of the connection, or a new card of the statement's currency. */
export type StatementTarget =
  | { kind: 'account'; accountId: string }
  | {
      kind: 'new';
      /** A fresh id from the caller (the core makes no ids); it is stored under storedId. */
      id: string;
      /** The provider's card type, or null (then the file's, if it states one). */
      type: string | null;
    };

/** Where a statement goes in a comparison: an account (the caller's target, or matched), or a new account. */
export type StatementMatch = { kind: 'account'; accountId: string; by: 'target' | 'iban' | 'card' } | { kind: 'new' };

/** Why a file is not written: a token connection, another currency, a hole in the account's coverage. */
export type StatementBlock = 'token' | 'currency' | 'gap';

/** One statement of a file against its account. */
export interface StatementComparison {
  match: StatementMatch;
  rows: number;
  /** The same second and amount as a stored row of the account. */
  matched: number;
  /** The same second as a stored row, another amount. */
  amountDiffers: number;
  /** Rows the account does not have. */
  added: number;
  /** Stored rows of the account inside the statement's span that the file does not have. */
  missingInFile: number;
  /** The span of the statement, unix seconds. */
  span: Window;
  /** The part between the account's coverage and the statement that neither has (unix seconds), or null. */
  gap: Window | null;
  blocked: StatementBlock | null;
}

export class StatementImportError extends Error {
  override name = 'StatementImportError';
  constructor(readonly reason: StatementBlock) {
    super(`Statement not written: ${reason}`);
  }
}

/** Ids of a file's rows: the account, the second, the amount and the order among equal ones — the same for the same row in every upload. */
export function statementRowIds(accountId: string, rows: ReadonlyArray<{ time: number; amount: number }>): string[] {
  const seen = new Map<string, number>();
  return rows.map((r) => {
    const key = `${r.time}:${r.amount}`;
    const n = seen.get(key) ?? 0;
    seen.set(key, n + 1);
    return `${accountId}:${key}:${n}`;
  });
}

type CardAccount = { id: string; currencyCode: number; updatedAt: number; iban: string | null; cards: string[] };

/** One statement with the account it goes to (null: a new one). */
type Planned = { statement: ParsedStatement; match: StatementMatch; account: CardAccount | null };

type Plan = { provider: ProviderId; file: boolean; accounts: CardAccount[]; planned: Planned[] };

const normIban = (iban: string | null) => iban?.replace(/\s+/g, '').toUpperCase() || null;
const normCard = (card: string) => card.replace(/\s+/g, '');

function cardsOf(maskedPan: unknown): string[] {
  if (maskedPan === null || maskedPan === undefined) return [];
  try {
    const v: unknown = JSON.parse(String(maskedPan));
    return Array.isArray(v) ? v.filter((c): c is string => typeof c === 'string') : [];
  } catch {
    return [];
  }
}

/** The file's statements with their accounts: the caller's targets first, then IBAN, then card; each account at most once. */
async function plan(db: Db, connectionId: number, statements: readonly ParsedStatement[], targets: ReadonlyArray<StatementTarget | null>): Promise<Plan> {
  if (statements.length === 0 || statements.some((s) => s.rows.length === 0)) throw new ConnectionError('A statement without rows');
  const c = await db.execute({ sql: 'SELECT provider, method FROM connections WHERE id = ?', args: [connectionId] });
  const conn = c.rows[0];
  if (!conn) throw new ConnectionError('No such connection');
  const provider = parseProviderId(conn.provider);
  const a = await db.execute({
    sql: 'SELECT id, currency_code, updated_at, iban, masked_pan FROM accounts WHERE connection_id = ? AND kind = ? ORDER BY id',
    args: [connectionId, 'card'],
  });
  const accounts: CardAccount[] = a.rows.map((r) => ({
    id: String(r.id),
    currencyCode: Number(r.currency_code),
    updatedAt: Number(r.updated_at),
    iban: r.iban === null ? null : String(r.iban),
    cards: cardsOf(r.masked_pan),
  }));

  const taken = new Set<string>();
  const planned: Array<Planned | null> = statements.map(() => null);
  for (const [i, statement] of statements.entries()) {
    const target = targets[i] ?? null;
    if (target === null) continue;
    const id = target.kind === 'account' ? target.accountId : storedId(provider, target.id);
    if (taken.has(id)) throw new ConnectionError('Two statements of the file go to one account');
    taken.add(id);
    if (target.kind === 'new') {
      const exists = await db.execute({ sql: 'SELECT 1 FROM accounts WHERE id = ?', args: [id] });
      if (exists.rows.length > 0) throw new ConnectionError('The new account id is taken');
      planned[i] = { statement, match: { kind: 'new' }, account: null };
    } else {
      const account = accounts.find((x) => x.id === id);
      if (!account) throw new ConnectionError('No such card in this connection');
      planned[i] = { statement, match: { kind: 'account', accountId: id, by: 'target' }, account };
    }
  }
  for (const [i, statement] of statements.entries()) {
    if (planned[i]) continue;
    const free = accounts.filter((x) => !taken.has(x.id));
    const iban = normIban(statement.account.iban);
    const byIban = iban === null ? undefined : free.find((x) => normIban(x.iban) === iban);
    const cards = new Set(statement.account.cards.map(normCard));
    const byCard = byIban ? undefined : free.find((x) => x.cards.some((card) => cards.has(normCard(card))));
    const account = byIban ?? byCard;
    if (account) taken.add(account.id);
    planned[i] = account
      ? { statement, match: { kind: 'account', accountId: account.id, by: byIban ? 'iban' : 'card' }, account }
      : { statement, match: { kind: 'new' }, account: null };
  }
  return { provider, file: parseConnectionMethod(conn.method) === 'file', accounts, planned: planned.filter((p) => p !== null) };
}

function spanOf(statement: ParsedStatement): Window {
  const times = statement.rows.map((r) => r.time);
  return { from: Math.min(...times), to: Math.max(...times) };
}

async function compareOne(db: Db, file: boolean, { statement, match, account }: Planned): Promise<StatementComparison> {
  const span = spanOf(statement);

  const stored = account
    ? (
        await db.execute({
          sql: 'SELECT time, amount FROM transactions WHERE account_id = ? AND time BETWEEN ? AND ? AND is_cancelled = 0',
          args: [account.id, span.from, span.to],
        })
      ).rows.map((r) => ({ time: Number(r.time), amount: Number(r.amount) }))
    : [];
  // Multisets: an exact match first, then the same second with another amount.
  const exact = new Map<string, number>();
  const bySecond = new Map<number, number>();
  for (const r of stored) {
    exact.set(`${r.time}:${r.amount}`, (exact.get(`${r.time}:${r.amount}`) ?? 0) + 1);
    bySecond.set(r.time, (bySecond.get(r.time) ?? 0) + 1);
  }
  const take = <K>(m: Map<K, number>, k: K) => {
    const n = m.get(k) ?? 0;
    if (n > 0) m.set(k, n - 1);
    return n > 0;
  };
  let matched = 0;
  const rest: Array<{ time: number }> = [];
  for (const r of statement.rows) {
    if (take(exact, `${r.time}:${r.amount}`)) {
      matched++;
      take(bySecond, r.time);
    } else {
      rest.push(r);
    }
  }
  let amountDiffers = 0;
  for (const r of rest) if (take(bySecond, r.time)) amountDiffers++;
  const missingInFile = [...bySecond.values()].reduce((a, b) => a + b, 0);

  const state = account ? await getSyncState(db, account.id) : null;
  let gap: Window | null = null;
  if (state && span.from > state.newest) gap = { from: state.newest, to: span.from };
  else if (state && span.to < state.oldest) gap = { from: span.to, to: state.oldest };

  const blocked: StatementBlock | null = !file
    ? 'token'
    : account && account.currencyCode !== statement.currencyCode
      ? 'currency'
      : gap
        ? 'gap'
        : null;

  return {
    match,
    rows: statement.rows.length,
    matched,
    amountDiffers,
    added: statement.rows.length - matched - amountDiffers,
    missingInFile,
    span,
    gap,
    blocked,
  };
}

/**
 * Every statement of the file against its account, in the file's order. `targets[i]` is the caller's choice for
 * statement i; absent or null — matched by IBAN, then by card, else new.
 */
export async function compareStatement(
  db: Db,
  connectionId: number,
  statements: readonly ParsedStatement[],
  targets: ReadonlyArray<StatementTarget | null> = [],
): Promise<StatementComparison[]> {
  const { file, planned } = await plan(db, connectionId, statements, targets);
  const out: StatementComparison[] = [];
  for (const p of planned) out.push(await compareOne(db, file, p));
  return out;
}

/**
 * Writes every statement of the file into its target, one per statement, in one transaction; anything
 * `compareStatement` blocks for any statement → StatementImportError, and nothing is written.
 */
export async function commitStatement(
  db: Db,
  connectionId: number,
  statements: readonly ParsedStatement[],
  targets: readonly StatementTarget[],
  nowSec: number,
): Promise<{ added: number }> {
  if (targets.length !== statements.length) throw new ConnectionError('One target per statement');
  const { provider, file, accounts, planned } = await plan(db, connectionId, statements, targets);
  const comparisons: StatementComparison[] = [];
  for (const p of planned) comparisons.push(await compareOne(db, file, p));
  const blocked = comparisons.find((c) => c.blocked !== null)?.blocked;
  if (blocked) throw new StatementImportError(blocked);

  const knownIbans = new Set(accounts.map((a) => normIban(a.iban)).filter((x) => x !== null));
  const knownCards = new Set(accounts.flatMap((a) => a.cards.map(normCard)));
  let brought = false;
  const stmts: Stmt[] = [];
  const accountIds: string[] = [];
  let added = 0;
  for (const [i, { statement, account }] of planned.entries()) {
    const target = targets[i]!;
    const accountId = target.kind === 'new' ? storedId(provider, target.id) : target.accountId;
    accountIds.push(accountId);
    const span = comparisons[i]!.span;
    const ids = statementRowIds(accountId, statement.rows);
    const iban = statement.account.iban;
    const before: Stmt[] = [];
    if (target.kind === 'new') {
      // The balance is the bank's after the newest row: updated_at is that row's time, as the month-end balance reads it.
      before.push({
        sql: `INSERT INTO accounts (id, connection_id, kind, type, currency_code, iban, masked_pan, balance, updated_at)
              VALUES (?, ?, 'card', ?, ?, ?, ?, ?, ?)`,
        args: [
          accountId, connectionId, target.type ?? statement.account.type, statement.currencyCode, iban,
          statement.account.cards.length > 0 ? JSON.stringify(statement.account.cards) : null, statement.closingBalance ?? 0, span.to,
        ],
      });
      if ((iban !== null && !knownIbans.has(normIban(iban) ?? '')) || statement.account.cards.some((c) => !knownCards.has(normCard(c)))) brought = true;
    } else if (account) {
      if (statement.closingBalance !== null && span.to > account.updatedAt) {
        before.push({ sql: 'UPDATE accounts SET balance = ?, updated_at = ? WHERE id = ?', args: [statement.closingBalance, span.to, accountId] });
      }
      if (iban !== null && account.iban === null) {
        before.push({ sql: 'UPDATE accounts SET iban = ? WHERE id = ? AND iban IS NULL', args: [iban, accountId] });
        if (!knownIbans.has(normIban(iban) ?? '')) brought = true;
      }
      const have = new Set(account.cards.map(normCard));
      const newCards = statement.account.cards.filter((c) => !have.has(normCard(c)));
      if (newCards.length > 0) {
        before.push({ sql: 'UPDATE accounts SET masked_pan = ? WHERE id = ?', args: [JSON.stringify([...account.cards, ...newCards]), accountId] });
        if (newCards.some((c) => !knownCards.has(normCard(c)))) brought = true;
      }
    }

    const known = new Set(
      account
        ? (
            await db.execute({ sql: 'SELECT id FROM transactions WHERE account_id = ? AND time BETWEEN ? AND ?', args: [accountId, span.from, span.to] })
          ).rows.map((r) => String(r.id))
        : [],
    );
    added += ids.filter((id) => !known.has(id)).length;
    const prepared = await prepareRows(db, {
      provider,
      accountId,
      window: span,
      items: statement.rows.map((r, j) => ({ ...r, id: ids[j] ?? '' })),
      nowSec,
      cancelHolds: false,
      before,
    });
    stmts.push(...prepared.stmts);
  }
  await db.batch(stmts);

  // The pass over the file's whole span is the incremental step. A full pass only when it failed, or when the file
  // brought an IBAN or a card number: an IBAN lets the `iban` rule see rows of other accounts outside that span.
  const whole: Window = { from: Math.min(...comparisons.map((c) => c.span.from)), to: Math.max(...comparisons.map((c) => c.span.to)) };
  const { derivationFailed } = await deriveCommitted(db, whole, accountIds.join(', '));
  if (derivationFailed || brought) await rederiveCore(db);
  return { added };
}
