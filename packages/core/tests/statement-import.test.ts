// A statement file into an account: the comparison (counts only) and the write. Invented data only.
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import type { Db } from '../src/db.ts';
import { addConnection, addParticipant } from '../src/participants.ts';
import { monobankStatement } from '../src/providers/monobank/statement.ts';
import type { ParsedStatement } from '../src/providers/types.ts';
import { StatementImportError, commitStatement, compareStatement, statementRowIds } from '../src/statement-import.ts';
import { commitRows } from '../src/sync.ts';
import { insertAccountRow, memoryDb, testConnection } from './helpers.ts';

let db: Db;
afterEach(() => db?.close());

const card = (): ParsedStatement => {
  const r = monobankStatement.parse(readFileSync(new URL('./providers/monobank/fixtures/statement-card-uk.csv', import.meta.url), 'utf8'));
  if (!r.ok) throw new Error(r.problem);
  return r.statement;
};
const rows = async (sql: string, args: Array<string | number> = []) => (await db.execute({ sql, args })).rows;
const kyiv = (iso: string) => Math.floor(Date.parse(`${iso}+03:00`) / 1000);

/** One person with a file connection; returns its id. */
async function fileConnection(): Promise<number> {
  db = await memoryDb();
  const me = await addParticipant(db, { label: 'Вигадана Особа' }, 0);
  return addConnection(db, me, 'monobank', 0, 'file');
}

describe('statementRowIds', () => {
  it('the same for the same rows; equal rows in one second get their order', () => {
    const r = [{ time: 10, amount: -100 }, { time: 10, amount: -100 }, { time: 11, amount: 5 }];
    expect(statementRowIds('acc', r)).toEqual(['acc:10:-100:0', 'acc:10:-100:1', 'acc:11:5:0']);
    expect(statementRowIds('acc', r)).toEqual(statementRowIds('acc', r));
  });
});

describe('a file connection', () => {
  it('a new card: the rows, the balance after the newest row, the coverage of the file', async () => {
    const conn = await fileConnection();
    const st = card();
    const target = { kind: 'new', id: 'file-card-1', type: 'black' } as const;
    expect(await compareStatement(db, conn, st, target)).toMatchObject({ rows: 5, matched: 0, added: 5, missingInFile: 0, gap: null, blocked: null });

    expect(await commitStatement(db, conn, st, target, 999)).toEqual({ added: 5 });
    expect(await rows('SELECT connection_id, kind, type, currency_code, balance, updated_at, iban FROM accounts')).toEqual([
      { connection_id: conn, kind: 'card', type: 'black', currency_code: 980, balance: 961770, updated_at: kyiv('2026-10-07T12:15:42'), iban: null },
    ]);
    expect(await rows('SELECT oldest_synced_time, newest_synced_time FROM sync_state')).toEqual([
      { oldest_synced_time: kyiv('2026-10-03T09:05:11'), newest_synced_time: kyiv('2026-10-07T12:15:42') },
    ]);
    expect((await rows('SELECT COUNT(*) AS n FROM transactions'))[0]?.n).toBe(5);
  });

  it('the same file twice adds nothing; an overlapping newer file adds only its new rows and moves the balance', async () => {
    const conn = await fileConnection();
    await commitStatement(db, conn, card(), { kind: 'new', id: 'c', type: null }, 1);
    const target = { kind: 'account', accountId: 'c' } as const;
    expect(await compareStatement(db, conn, card(), target)).toMatchObject({ matched: 5, added: 0, blocked: null });
    expect(await commitStatement(db, conn, card(), target, 2)).toEqual({ added: 0 });

    const later = card();
    const t = kyiv('2026-10-08T08:00:00');
    later.rows = [...later.rows.slice(3), { time: t, amount: -10000, currencyCode: 980, hold: false, mcc: 5411, description: 'Тест Маркет', balance: 951770, raw: '{}' }];
    later.closingBalance = 951770;
    expect(await compareStatement(db, conn, later, target)).toMatchObject({ rows: 3, matched: 2, added: 1 });
    expect(await commitStatement(db, conn, later, target, 3)).toEqual({ added: 1 });
    expect(await rows('SELECT balance, updated_at FROM accounts')).toEqual([{ balance: 951770, updated_at: t }]);
    expect((await rows('SELECT COUNT(*) AS n FROM transactions'))[0]?.n).toBe(6);
  });

  it('an older file does not move the balance back', async () => {
    const conn = await fileConnection();
    await commitStatement(db, conn, card(), { kind: 'new', id: 'c', type: null }, 1);
    const older = card();
    older.rows = older.rows.slice(0, 2);
    older.closingBalance = 1190500;
    await commitStatement(db, conn, older, { kind: 'account', accountId: 'c' }, 2);
    expect(await rows('SELECT balance FROM accounts')).toEqual([{ balance: 961770 }]);
  });

  it('a hole between the coverage and the file, or another currency: compared, not written', async () => {
    const conn = await fileConnection();
    await commitStatement(db, conn, card(), { kind: 'new', id: 'c', type: null }, 1);
    const target = { kind: 'account', accountId: 'c' } as const;

    const far = card();
    far.rows = far.rows.map((r) => ({ ...r, time: r.time + 30 * 86_400 }));
    const cmp = await compareStatement(db, conn, far, target);
    expect(cmp.blocked).toBe('gap');
    expect(cmp.gap).toEqual({ from: kyiv('2026-10-07T12:15:42'), to: kyiv('2026-10-03T09:05:11') + 30 * 86_400 });
    await expect(commitStatement(db, conn, far, target, 2)).rejects.toEqual(new StatementImportError('gap'));

    const usd = { ...card(), currencyCode: 840 };
    expect((await compareStatement(db, conn, usd, target)).blocked).toBe('currency');
    await expect(commitStatement(db, conn, usd, target, 2)).rejects.toBeInstanceOf(StatementImportError);
    expect((await rows('SELECT COUNT(*) AS n FROM transactions'))[0]?.n).toBe(5);
  });

  it('a card of another connection, or a taken new id, is refused', async () => {
    const conn = await fileConnection();
    await insertAccountRow(db, { id: 'theirs', kind: 'card', currency_code: 980, balance: 0, updated_at: 0 });
    await expect(compareStatement(db, conn, card(), { kind: 'account', accountId: 'theirs' })).rejects.toThrow(/No such card/);
    await expect(compareStatement(db, conn, card(), { kind: 'new', id: 'theirs', type: null })).rejects.toThrow(/taken/);
  });
});

describe('a token connection: the reference check', () => {
  /** The token account holds the same invented operations as the API would send them (the bank's own ids). */
  async function apiAccount(): Promise<number> {
    db = await memoryDb();
    const conn = await testConnection(db);
    await insertAccountRow(db, { id: 'api-black', kind: 'card', type: 'black', currency_code: 980, balance: 961770, updated_at: kyiv('2026-10-07T13:00:00') });
    const st = card();
    await commitRows(db, {
      provider: 'monobank',
      accountId: 'api-black',
      window: { from: st.rows[0]!.time - 60, to: st.rows.at(-1)!.time + 60 },
      items: st.rows.map((r, i) => ({ ...r, id: `bank-id-${i}` })),
      nowSec: 1,
      cancelHolds: true,
    });
    return conn;
  }

  it('the same operations match one to one; nothing is written', async () => {
    const conn = await apiAccount();
    const target = { kind: 'account', accountId: 'api-black' } as const;
    expect(await compareStatement(db, conn, card(), target)).toMatchObject({ rows: 5, matched: 5, amountDiffers: 0, added: 0, missingInFile: 0, blocked: 'token' });
    await expect(commitStatement(db, conn, card(), target, 2)).rejects.toEqual(new StatementImportError('token'));
    await expect(commitStatement(db, conn, card(), { kind: 'new', id: 'x', type: null }, 2)).rejects.toEqual(new StatementImportError('token'));
  });

  it('a differing amount, a row only in the file, a row only in the account', async () => {
    const conn = await apiAccount();
    const st = card();
    st.rows = [
      { ...st.rows[0]!, amount: st.rows[0]!.amount + 1 }, // the same second, another amount
      ...st.rows.slice(1, 4), // matched
      { ...st.rows[1]!, time: st.rows[1]!.time + 1 }, // only in the file
    ]; // the newest stored row is not in the file
    st.rows.sort((a, b) => a.time - b.time);
    expect(await compareStatement(db, conn, st, { kind: 'account', accountId: 'api-black' })).toMatchObject({
      rows: 5, matched: 3, amountDiffers: 1, added: 1, missingInFile: 0,
    });
  });

  it('a file account gets the categories and transfer marks the API rows got', async () => {
    const conn = await apiAccount();
    const me = Number((await rows('SELECT participant_id FROM connections WHERE id = ?', [conn]))[0]?.participant_id);
    const fileConn = await addConnection(db, me, 'monobank', 0, 'file');
    // Not the same person's second copy in practice; here only to compare the derivation side by side.
    await commitStatement(db, fileConn, card(), { kind: 'new', id: 'file-black', type: 'black' }, 2);
    const of = async (account: string) =>
      (await rows('SELECT time, category, scope FROM transactions WHERE account_id = ? ORDER BY time', [account])).map((r) => [r.time, r.category, r.scope]);
    expect(await of('file-black')).toEqual(await of('api-black'));
  });
});
