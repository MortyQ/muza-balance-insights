// The messages between main and the data process (src/shared/data-protocol.ts): a closed list of methods, each with
// its own argument tuple; the key only in `open`; errors as a code and a name. Fictional data only.
import { describe, expect, it } from 'vitest';
import { ARG_SCHEMAS } from '../src/shared/ipc-args.ts';
import { CallMessage, DATA_ARG_SCHEMAS, DATA_METHODS, FromData, ToData } from '../src/shared/data-protocol.ts';

const row = { time: 1_700_000_000, amount: -12_345, currencyCode: 980, hold: false, mcc: 5411, description: 'Вигаданий магазин', raw: 'a;b;c' };
const statement = { kind: 'card', currencyCode: 980, account: { iban: null, cards: [], type: null }, rows: [row], closingBalance: null };
const NEW_ID = 'file-00000000-0000-4000-8000-000000000001';

describe('data protocol', () => {
  it('every method has its argument tuple, and the list is exactly those methods', () => {
    expect(DATA_METHODS).toEqual(Object.keys(DATA_ARG_SCHEMAS));
    expect(new Set(DATA_METHODS).size).toBe(DATA_METHODS.length);
  });

  it('the IPC-facing methods check their arguments with the IPC schemas themselves', () => {
    expect(DATA_ARG_SCHEMAS.monthOverview).toBe(ARG_SCHEMAS.getMonthOverview);
    expect(DATA_ARG_SCHEMAS.setAccountEnabled).toBe(ARG_SCHEMAS.setAccountEnabled);
    expect(DATA_ARG_SCHEMAS.connectionAccounts).toBe(ARG_SCHEMAS.listConnectionAccounts);
  });

  it('a call names a listed method only; there is no message with SQL', () => {
    expect(CallMessage.safeParse({ type: 'call', id: 1, method: 'status', args: [] }).success).toBe(true);
    expect(CallMessage.safeParse({ type: 'call', id: 1, method: 'execute', args: ['SELECT 1'] }).success).toBe(false);
    expect(ToData.safeParse({ type: 'sql', sql: 'SELECT 1' }).success).toBe(false);
    expect(CallMessage.safeParse({ type: 'call', id: 1, method: 'status', args: [], sql: 'x' }).success).toBe(false);
  });

  it('extra or wrong arguments are refused', () => {
    expect(DATA_ARG_SCHEMAS.status.safeParse([]).success).toBe(true);
    expect(DATA_ARG_SCHEMAS.status.safeParse([1]).success).toBe(false);
    expect(DATA_ARG_SCHEMAS.deleteConnection.safeParse([3]).success).toBe(true);
    expect(DATA_ARG_SCHEMAS.deleteConnection.safeParse([3, 4]).success).toBe(false);
    expect(DATA_ARG_SCHEMAS.deleteConnection.safeParse([-1]).success).toBe(false);
    expect(DATA_ARG_SCHEMAS.createConnection.safeParse([{ label: 'Вигадана' }, 'monobank', 'file']).success).toBe(true);
    expect(DATA_ARG_SCHEMAS.createConnection.safeParse([{ label: 'Вигадана' }, 'nobank', 'file']).success).toBe(false);
    expect(DATA_ARG_SCHEMAS.createConnection.safeParse([{ label: 'Вигадана' }, 'monobank', 'api']).success).toBe(false);
  });

  it('a statement: its rows as the parsers fill them, nothing else; a new card only with main\'s id', () => {
    const ok = (rows: unknown[], target: unknown) => DATA_ARG_SCHEMAS.commitStatement.safeParse([1, { ...statement, rows }, target]).success;
    expect(ok([row], { kind: 'new', id: NEW_ID, type: 'black' })).toBe(true);
    expect(ok([row], { kind: 'account', accountId: 'acc-1' })).toBe(true);
    expect(ok([{ ...row, extra: 1 }], { kind: 'account', accountId: 'acc-1' })).toBe(false);
    // A bank that sends no MCC, with its own category; an MCC is still a whole number when present.
    const { mcc: _mcc, ...noMcc } = row;
    expect(ok([{ ...noMcc, bankCategory: 'Вигадана категорія' }], { kind: 'account', accountId: 'acc-1' })).toBe(true);
    expect(ok([{ ...row, mcc: '5411' }], { kind: 'account', accountId: 'acc-1' })).toBe(false);
    expect(ok([], { kind: 'account', accountId: 'acc-1' })).toBe(false);
    expect(ok([row], { kind: 'new', id: 'acc-1', type: null })).toBe(false);
  });

  it("a statement's account: what the file states, within limits, nothing else", () => {
    const ok = (account: unknown) =>
      DATA_ARG_SCHEMAS.commitStatement.safeParse([1, { ...statement, account }, { kind: 'account', accountId: 'acc-1' }]).success;
    expect(ok({ iban: 'UA003000000000000000000000001', cards: ['4441 11** **** 1111'], type: 'black' })).toBe(true);
    expect(ok({ iban: null, cards: [], type: null })).toBe(true);
    expect(ok({ iban: 'U'.repeat(35), cards: [], type: null })).toBe(false);
    expect(ok({ iban: null, cards: Array.from({ length: 17 }, () => '4441'), type: null })).toBe(false);
    expect(ok({ iban: null, cards: [], type: null, holder: 'Вигадана' })).toBe(false);
    expect(ok(undefined)).toBe(false);
  });

  it('the key: 64 lowercase hex characters or null, only in `open`', () => {
    const open = (dbKey: unknown) => ToData.safeParse({ type: 'open', dbPath: '/x/monobank.db', dbKey }).success;
    expect(open('a'.repeat(64))).toBe(true);
    expect(open(null)).toBe(true);
    expect(open('A'.repeat(64))).toBe(false);
    expect(open('a'.repeat(63))).toBe(false);
    expect(ToData.safeParse({ type: 'rates', rates: null, dbKey: 'a'.repeat(64) }).success).toBe(false);
  });

  it('replies: an error is a known code and a bounded name, with no message', () => {
    expect(FromData.safeParse({ type: 'failure', id: 1, code: 'connection', name: 'ConnectionError' }).success).toBe(true);
    expect(FromData.safeParse({ type: 'failure', id: 1, code: 'other', name: 'Error' }).success).toBe(false);
    expect(FromData.safeParse({ type: 'failure', id: 1, code: 'failed', name: 'x'.repeat(81) }).success).toBe(false);
    expect(FromData.safeParse({ type: 'failure', id: 1, code: 'failed', name: 'Error', message: 'details' }).success).toBe(false);
    expect(FromData.safeParse({ type: 'open-failed', kind: 'unreadable', name: 'LibsqlError' }).success).toBe(true);
  });
});
