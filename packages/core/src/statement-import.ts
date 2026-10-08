// A statement file into an account: first compared with what the account already has (counts only), then written —
// the account (new, or its balance), the rows and the coverage in one transaction, then the derivation passes as for
// the API (commitRows). Only an account of a file connection is written; a token connection's account can be compared
// with a file (the reference check), never written from one.
import { ConnectionError, parseConnectionMethod, parseProviderId } from './connections.ts';
import type { Db, Stmt } from './db.ts';
import type { ParsedStatement } from './providers/types.ts';
import { commitRows, getSyncState, type Window } from './sync.ts';

/** Where the rows go: an account of the connection, or a new card of the file's currency. */
export type StatementTarget =
  | { kind: 'account'; accountId: string }
  | { kind: 'new'; /** A fresh id from the caller (the core makes no ids). */ id: string; /** The provider's card type, or null. */ type: string | null };

/** Why a file is not written: a token connection, another currency, a hole in the account's coverage. */
export type StatementBlock = 'token' | 'currency' | 'gap';

export interface StatementComparison {
  rows: number;
  /** The same second and amount as a stored row of the account. */
  matched: number;
  /** The same second as a stored row, another amount. */
  amountDiffers: number;
  /** Rows the account does not have. */
  added: number;
  /** Stored rows of the account inside the file's span that the file does not have. */
  missingInFile: number;
  /** The span of the file, unix seconds. */
  span: Window;
  /** The part between the account's coverage and the file that neither has (unix seconds), or null. */
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

type Resolved = { provider: ReturnType<typeof parseProviderId>; file: boolean; account: { id: string; currencyCode: number; updatedAt: number } | null };

async function resolve(db: Db, connectionId: number, target: StatementTarget): Promise<Resolved> {
  const c = await db.execute({ sql: 'SELECT provider, method FROM connections WHERE id = ?', args: [connectionId] });
  const conn = c.rows[0];
  if (!conn) throw new ConnectionError('No such connection');
  const base = { provider: parseProviderId(conn.provider), file: parseConnectionMethod(conn.method) === 'file' };
  if (target.kind === 'new') {
    const taken = await db.execute({ sql: 'SELECT 1 FROM accounts WHERE id = ?', args: [target.id] });
    if (taken.rows.length > 0) throw new ConnectionError('The new account id is taken');
    return { ...base, account: null };
  }
  const a = await db.execute({
    sql: 'SELECT id, currency_code, updated_at FROM accounts WHERE id = ? AND connection_id = ? AND kind = ?',
    args: [target.accountId, connectionId, 'card'],
  });
  const row = a.rows[0];
  if (!row) throw new ConnectionError('No such card in this connection');
  return { ...base, account: { id: String(row.id), currencyCode: Number(row.currency_code), updatedAt: Number(row.updated_at) } };
}

function spanOf(statement: ParsedStatement): Window {
  const times = statement.rows.map((r) => r.time);
  return { from: Math.min(...times), to: Math.max(...times) };
}

export async function compareStatement(db: Db, connectionId: number, statement: ParsedStatement, target: StatementTarget): Promise<StatementComparison> {
  const { file, account } = await resolve(db, connectionId, target);
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

/** Writes the file into a file connection's account; anything `compareStatement` blocks → StatementImportError. */
export async function commitStatement(
  db: Db,
  connectionId: number,
  statement: ParsedStatement,
  target: StatementTarget,
  nowSec: number,
): Promise<{ added: number }> {
  const comparison = await compareStatement(db, connectionId, statement, target);
  if (comparison.blocked) throw new StatementImportError(comparison.blocked);
  const { provider, account } = await resolve(db, connectionId, target);
  const accountId = target.kind === 'new' ? target.id : target.accountId;
  const span = comparison.span;
  const newestTime = span.to;
  const ids = statementRowIds(accountId, statement.rows);

  const before: Stmt[] = [];
  if (target.kind === 'new') {
    // The balance is the bank's after the newest row: updated_at is that row's time, as the month-end balance reads it.
    before.push({
      sql: `INSERT INTO accounts (id, connection_id, kind, type, currency_code, balance, updated_at)
            VALUES (?, ?, 'card', ?, ?, ?, ?)`,
      args: [accountId, connectionId, target.type, statement.currencyCode, statement.closingBalance ?? 0, newestTime],
    });
  } else if (statement.closingBalance !== null && account && newestTime > account.updatedAt) {
    before.push({ sql: 'UPDATE accounts SET balance = ?, updated_at = ? WHERE id = ?', args: [statement.closingBalance, newestTime, accountId] });
  }

  const known = new Set(
    target.kind === 'new'
      ? []
      : (
          await db.execute({ sql: 'SELECT id FROM transactions WHERE account_id = ? AND time BETWEEN ? AND ?', args: [accountId, span.from, span.to] })
        ).rows.map((r) => String(r.id)),
  );
  await commitRows(db, {
    provider,
    accountId,
    window: span,
    items: statement.rows.map((r, i) => ({ ...r, id: ids[i] ?? '' })),
    nowSec,
    cancelHolds: false,
    before,
  });
  return { added: ids.filter((id) => !known.has(id)).length };
}
