// A statement file into a connection's accounts: matching, the comparison (counts only) and the write — every account
// of the file or none. Invented data only.
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import type { Db } from '../../src/storage/db.ts';
import { addConnection, addParticipant } from '../../src/people/participants.ts';
import { monobankCardReader } from '../../src/providers/monobank/statement.ts';
import type { ParsedStatement, StatementAccount } from '../../src/providers/types.ts';
import { StatementImportError, commitStatement, compareStatement, statementRowIds } from '../../src/ingest/statement-import.ts';
import { commitRows } from '../../src/ingest/commit.ts';
import { rederiveCore } from '../../src/derive/rederive.ts';
import { derivedColumns, insertAccountRow, memoryDb, testConnection } from '../helpers.ts';

let db: Db;
afterEach(() => db?.close());

const card = (): ParsedStatement => {
  const r = monobankCardReader.read({ format: 'text', text: readFileSync(new URL('../providers/monobank/fixtures/statement-card-uk.csv', import.meta.url), 'utf8') });
  if (!r.ok) throw new Error(r.problem);
  return r.statements[0]!;
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
    expect((await compareStatement(db, conn, [st], [target]))[0]).toMatchObject({ rows: 5, matched: 0, added: 5, missingInFile: 0, gap: null, blocked: null });

    expect(await commitStatement(db, conn, [st], [target], 999)).toEqual({ added: 5 });
    expect(await rows('SELECT connection_id, kind, type, currency_code, balance, updated_at, iban FROM accounts')).toEqual([
      { connection_id: conn, kind: 'card', type: 'black', currency_code: 980, balance: 961770, updated_at: kyiv('2026-10-07T12:15:42'), iban: null },
    ]);
    expect(await rows('SELECT oldest_synced_time, newest_synced_time FROM sync_state')).toEqual([
      { oldest_synced_time: kyiv('2026-10-03T09:05:11'), newest_synced_time: kyiv('2026-10-07T12:15:42') },
    ]);
    expect((await rows('SELECT COUNT(*) AS n FROM transactions'))[0]?.n).toBe(5);
    // Monobank's ids are bare: the account is stored under the caller's id, and its rows' ids start with it.
    expect(await rows('SELECT id FROM accounts')).toEqual([{ id: 'file-card-1' }]);
    expect((await rows('SELECT id FROM transactions')).every((r) => String(r.id).startsWith('file-card-1:'))).toBe(true);
    // Each row's payload is the file's own row, stored apart, next to its operation.
    const payload = await rows('SELECT r.raw_json FROM transaction_raw r JOIN transactions t ON t.id = r.id');
    expect(payload.map((r) => String(r.raw_json)).sort()).toEqual(st.rows.map((r) => r.raw).sort());
  });

  it('an upload whose write fails leaves no account, no operation and no payload', async () => {
    const conn = await fileConnection();
    const st = card();
    const broken = { ...st, rows: st.rows.map((r, i) => (i === 3 ? { ...r, raw: null as unknown as string } : r)) };
    await expect(commitStatement(db, conn, [broken], [{ kind: 'new', id: 'file-card-1', type: 'black' }], 999)).rejects.toThrow();
    for (const table of ['accounts', 'transactions', 'transaction_raw', 'sync_state']) {
      expect((await rows(`SELECT COUNT(*) AS n FROM ${table}`))[0]?.n, table).toBe(0);
    }
  });

  it('the same file twice adds nothing; an overlapping newer file adds only its new rows and moves the balance', async () => {
    const conn = await fileConnection();
    await commitStatement(db, conn, [card()], [{ kind: 'new', id: 'c', type: null }], 1);
    const target = { kind: 'account', accountId: 'c' } as const;
    expect((await compareStatement(db, conn, [card()], [target]))[0]).toMatchObject({ matched: 5, added: 0, blocked: null });
    expect(await commitStatement(db, conn, [card()], [target], 2)).toEqual({ added: 0 });

    const later = card();
    const t = kyiv('2026-10-08T08:00:00');
    later.rows = [...later.rows.slice(3), { time: t, amount: -10000, currencyCode: 980, hold: false, mcc: 5411, description: 'Тест Маркет', balance: 951770, raw: '{}' }];
    later.closingBalance = 951770;
    expect((await compareStatement(db, conn, [later], [target]))[0]).toMatchObject({ rows: 3, matched: 2, added: 1 });
    expect(await commitStatement(db, conn, [later], [target], 3)).toEqual({ added: 1 });
    expect(await rows('SELECT balance, updated_at FROM accounts')).toEqual([{ balance: 951770, updated_at: t }]);
    expect((await rows('SELECT COUNT(*) AS n FROM transactions'))[0]?.n).toBe(6);
  });

  it('an older file does not move the balance back', async () => {
    const conn = await fileConnection();
    await commitStatement(db, conn, [card()], [{ kind: 'new', id: 'c', type: null }], 1);
    const older = card();
    older.rows = older.rows.slice(0, 2);
    older.closingBalance = 1190500;
    await commitStatement(db, conn, [older], [{ kind: 'account', accountId: 'c' }], 2);
    expect(await rows('SELECT balance FROM accounts')).toEqual([{ balance: 961770 }]);
  });

  it('a hole between the coverage and the file, or another currency: compared, not written', async () => {
    const conn = await fileConnection();
    await commitStatement(db, conn, [card()], [{ kind: 'new', id: 'c', type: null }], 1);
    const target = { kind: 'account', accountId: 'c' } as const;

    const far = card();
    far.rows = far.rows.map((r) => ({ ...r, time: r.time + 30 * 86_400 }));
    const cmp = (await compareStatement(db, conn, [far], [target]))[0]!;
    expect(cmp.blocked).toBe('gap');
    expect(cmp.gap).toEqual({ from: kyiv('2026-10-07T12:15:42'), to: kyiv('2026-10-03T09:05:11') + 30 * 86_400 });
    await expect(commitStatement(db, conn, [far], [target], 2)).rejects.toEqual(new StatementImportError('gap'));

    const usd = { ...card(), currencyCode: 840 };
    expect((await compareStatement(db, conn, [usd], [target]))[0]?.blocked).toBe('currency');
    await expect(commitStatement(db, conn, [usd], [target], 2)).rejects.toBeInstanceOf(StatementImportError);
    expect((await rows('SELECT COUNT(*) AS n FROM transactions'))[0]?.n).toBe(5);
  });

  it('a card of another connection, or a taken new id, is refused', async () => {
    const conn = await fileConnection();
    await insertAccountRow(db, { id: 'theirs', kind: 'card', currency_code: 980, balance: 0, updated_at: 0 });
    await expect(compareStatement(db, conn, [card()], [{ kind: 'account', accountId: 'theirs' }])).rejects.toThrow(/No such card/);
    await expect(compareStatement(db, conn, [card()], [{ kind: 'new', id: 'theirs', type: null }])).rejects.toThrow(/taken/);
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
    expect((await compareStatement(db, conn, [card()], [target]))[0]).toMatchObject({ rows: 5, matched: 5, amountDiffers: 0, added: 0, missingInFile: 0, blocked: 'token' });
    await expect(commitStatement(db, conn, [card()], [target], 2)).rejects.toEqual(new StatementImportError('token'));
    await expect(commitStatement(db, conn, [card()], [{ kind: 'new', id: 'x', type: null }], 2)).rejects.toEqual(new StatementImportError('token'));
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
    expect((await compareStatement(db, conn, [st], [{ kind: 'account', accountId: 'api-black' }]))[0]).toMatchObject({
      rows: 5, matched: 3, amountDiffers: 1, added: 1, missingInFile: 0,
    });
  });

  it('a file account gets the categories and transfer marks the API rows got', async () => {
    const conn = await apiAccount();
    const me = Number((await rows('SELECT participant_id FROM connections WHERE id = ?', [conn]))[0]?.participant_id);
    const fileConn = await addConnection(db, me, 'monobank', 0, 'file');
    // Not the same person's second copy in practice; here only to compare the derivation side by side.
    await commitStatement(db, fileConn, [card()], [{ kind: 'new', id: 'file-black', type: 'black' }], 2);
    const of = async (account: string) =>
      (await rows('SELECT time, category, scope FROM transactions WHERE account_id = ? ORDER BY time', [account])).map((r) => [r.time, r.category, r.scope]);
    expect(await of('file-black')).toEqual(await of('api-black'));
  });
});

describe('a file with several accounts', () => {
  const IBAN_A = 'UA003000000000000000000000001';
  const CARD_A = '4441 11** **** 1111';
  const CARD_B = '5168 55** **** 2222';

  /** One account of a fictional file: rows of [Kyiv time, amount], oldest first. */
  function statementOf(account: Partial<StatementAccount>, rows: Array<[string, number]>, currencyCode = 980): ParsedStatement {
    return {
      kind: 'card',
      currencyCode,
      account: { iban: null, cards: [], type: null, ...account },
      rows: rows.map(([iso, amount]) => ({
        time: kyiv(iso),
        amount,
        currencyCode,
        hold: false,
        description: 'Вигаданий магазин',
        raw: JSON.stringify({ iso, amount }),
      })),
      closingBalance: 5000,
    };
  }
  const fileOf = () => [
    statementOf({ iban: IBAN_A, cards: [CARD_A] }, [['2026-10-01T10:00:00', -100], ['2026-10-02T11:00:00', -200]]),
    statementOf({ cards: [CARD_B] }, [['2026-10-01T12:00:00', -300]]),
  ];
  const count = async (table: string) => Number((await rows(`SELECT COUNT(*) AS n FROM ${table}`))[0]?.n);

  async function uploaded(): Promise<number> {
    const conn = await fileConnection();
    await commitStatement(db, conn, fileOf(), [{ kind: 'new', id: 'a', type: null }, { kind: 'new', id: 'b', type: 'black' }], 1);
    return conn;
  }

  it('two accounts: offered as new, then written in one go with the IBAN and the cards; each row in one account', async () => {
    const conn = await fileConnection();
    const cmp = await compareStatement(db, conn, fileOf());
    expect(cmp.map((c) => [c.match, c.rows, c.added, c.blocked])).toEqual([
      [{ kind: 'new' }, 2, 2, null],
      [{ kind: 'new' }, 1, 1, null],
    ]);

    expect(await commitStatement(db, conn, fileOf(), [{ kind: 'new', id: 'a', type: null }, { kind: 'new', id: 'b', type: 'black' }], 1)).toEqual({ added: 3 });
    expect(await rows('SELECT id, type, iban, masked_pan, balance FROM accounts ORDER BY id')).toEqual([
      { id: 'a', type: null, iban: IBAN_A, masked_pan: JSON.stringify([CARD_A]), balance: 5000 },
      { id: 'b', type: 'black', iban: null, masked_pan: JSON.stringify([CARD_B]), balance: 5000 },
    ]);
    expect(await rows('SELECT account_id, COUNT(*) AS n FROM transactions GROUP BY account_id ORDER BY account_id')).toEqual([
      { account_id: 'a', n: 2 },
      { account_id: 'b', n: 1 },
    ]);
    // The stored values equal a full pass.
    const stored = await derivedColumns(db);
    await rederiveCore(db);
    expect(await derivedColumns(db)).toEqual(stored);
  });

  it('a re-upload matches both, by IBAN and by card, and adds nothing', async () => {
    const conn = await uploaded();
    const cmp = await compareStatement(db, conn, fileOf());
    expect(cmp.map((c) => [c.match, c.matched, c.added])).toEqual([
      [{ kind: 'account', accountId: 'a', by: 'iban' }, 2, 0],
      [{ kind: 'account', accountId: 'b', by: 'card' }, 1, 0],
    ]);
    // The card matches however the file spaces it.
    const spaced = fileOf();
    spaced[1]!.account.cards = [CARD_B.replaceAll(' ', '')];
    expect((await compareStatement(db, conn, spaced))[1]?.match).toEqual({ kind: 'account', accountId: 'b', by: 'card' });

    expect(await commitStatement(db, conn, fileOf(), [{ kind: 'account', accountId: 'a' }, { kind: 'account', accountId: 'b' }], 2)).toEqual({ added: 0 });
    expect(await count('accounts')).toBe(2);
    expect(await count('transactions')).toBe(3);
  });

  it('one blocked account blocks the file: the comparison names it, nothing is written', async () => {
    const conn = await uploaded();
    const file = [
      statementOf({ iban: IBAN_A }, [['2026-10-03T10:00:00', -100]], 840),
      statementOf({ iban: 'UA003000000000000000000000009' }, [['2026-10-03T10:00:00', -100]]),
    ];
    const cmp = await compareStatement(db, conn, file);
    expect(cmp.map((c) => [c.match, c.blocked])).toEqual([
      [{ kind: 'account', accountId: 'a', by: 'iban' }, 'currency'],
      [{ kind: 'new' }, null],
    ]);
    await expect(
      commitStatement(db, conn, file, [{ kind: 'account', accountId: 'a' }, { kind: 'new', id: 'c', type: null }], 2),
    ).rejects.toEqual(new StatementImportError('currency'));
    expect(await count('accounts')).toBe(2);
    expect(await count('transactions')).toBe(3);
  });

  it('an existing account gets the IBAN and the cards the file states', async () => {
    const conn = await uploaded();
    const file = [statementOf({ iban: 'UA003000000000000000000000002', cards: [CARD_B, '4441 11** **** 3333'] }, [['2026-10-01T12:00:00', -50]])];
    expect((await compareStatement(db, conn, file))[0]?.match).toEqual({ kind: 'account', accountId: 'b', by: 'card' });
    await commitStatement(db, conn, file, [{ kind: 'account', accountId: 'b' }], 2);
    expect(await rows("SELECT iban, masked_pan FROM accounts WHERE id = 'b'")).toEqual([
      { iban: 'UA003000000000000000000000002', masked_pan: JSON.stringify([CARD_B, '4441 11** **** 3333']) },
    ]);
  });

  it('two equal rows in one minute are both stored; a re-upload adds neither', async () => {
    const conn = await fileConnection();
    const minute = () => [statementOf({}, [['2026-10-01T10:15:00', -100], ['2026-10-01T10:15:00', -100], ['2026-10-01T10:16:00', -100]])];
    expect(await commitStatement(db, conn, minute(), [{ kind: 'new', id: 'm', type: null }], 1)).toEqual({ added: 3 });
    expect(await commitStatement(db, conn, minute(), [{ kind: 'account', accountId: 'm' }], 2)).toEqual({ added: 0 });
    expect(await count('transactions')).toBe(3);
  });

  it('two statements to one account, or a target missing, are refused before anything is written', async () => {
    const conn = await uploaded();
    await expect(
      compareStatement(db, conn, fileOf(), [{ kind: 'account', accountId: 'a' }, { kind: 'account', accountId: 'a' }]),
    ).rejects.toThrow(/one account/);
    await expect(commitStatement(db, conn, fileOf(), [{ kind: 'account', accountId: 'a' }], 2)).rejects.toThrow(/One target per statement/);
    expect(await count('transactions')).toBe(3);
  });
});
