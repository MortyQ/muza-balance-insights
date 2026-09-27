// End-of-month balances from the stored per-operation balance, with the backward calculation as the fallback.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Db } from '../src/db.ts';
import { kyivStartOfDay } from '../src/format.ts';
import { addConnection, addParticipant } from '../src/participants.ts';
import { balancesAt, firstDataDate } from '../src/status.ts';
import { insertAccountRow, memoryDb } from './helpers.ts';

let db: Db;
let seq = 0;
const END_JULY = kyivStartOfDay('2026-08-01');
const SYNCED = kyivStartOfDay('2026-09-27') + 12 * 3600;

async function account(id: string, balance: number, o: { creditLimit?: number; kind?: 'card' | 'jar'; oldest?: number | null; connection?: number } = {}) {
  await insertAccountRow(db, {
    id, kind: o.kind ?? 'card', type: o.kind === 'jar' ? null : 'black', currency_code: 980, balance, credit_limit: o.creditLimit ?? 0,
    updated_at: SYNCED, ...(o.connection ? { connection_id: o.connection } : {}),
  });
  if (o.oldest !== null) {
    await db.execute({ sql: 'INSERT INTO sync_state VALUES (?, ?, ?, ?)', args: [id, o.oldest ?? kyivStartOfDay('2026-06-14'), SYNCED, SYNCED] });
  }
}
async function tx(accountId: string, time: number, amount: number, balance: number | null, cancelled = 0) {
  await db.execute({
    sql: `INSERT INTO transactions (id, account_id, time, local_date, description, mcc, hold, amount, currency_code, balance, is_cancelled, raw_json, synced_at)
          VALUES (?, ?, ?, '2026-07-01', '', 5411, 0, ?, 980, ?, ?, '{}', 0)`,
    args: [`t${++seq}`, accountId, time, amount, balance, cancelled],
  });
}
const own = async (endSec: number, participantId?: number) =>
  Object.fromEntries((await balancesAt(db, { endSec, ...(participantId === undefined ? {} : { participantId }) })).accounts.map((a) => [a.id, a.own_funds]));

beforeEach(async () => { seq = 0; db = await memoryDb(); });
afterEach(() => db.close());

describe('balancesAt', () => {
  it('takes the balance after the last operation of the month (the bank\'s own number)', async () => {
    await account('a', 50_000);
    await tx('a', END_JULY - 100, -1_000, 70_000);
    await tx('a', END_JULY + 100, -20_000, 50_000);
    expect(await own(END_JULY)).toEqual({ a: 70_000 });
  });

  it('counts back from the current balance when the stored balance is missing or two operations share the last second', async () => {
    await account('a', 50_000);
    await account('b', 50_000);
    await tx('a', END_JULY - 100, -1_000, null);
    await tx('a', END_JULY + 100, -20_000, 50_000);
    await tx('b', END_JULY - 5, -1_000, 71_000);
    await tx('b', END_JULY - 5, 1_000, 70_000);
    await tx('b', END_JULY + 100, -20_000, 50_000);
    expect(await own(END_JULY)).toEqual({ a: 70_000, b: 70_000 });
  });

  it('ignores cancelled operations', async () => {
    await account('a', 50_000);
    await tx('a', END_JULY - 100, -1_000, 70_000);
    await tx('a', END_JULY - 50, -9_000, 61_000, 1);
    await tx('a', END_JULY + 100, -20_000, 50_000);
    expect(await own(END_JULY)).toEqual({ a: 70_000 });
  });

  it('no operation after the end → the current balance; the current month → the current balance', async () => {
    await account('a', 50_000);
    await tx('a', END_JULY - 100, -1_000, 50_000);
    expect(await own(END_JULY)).toEqual({ a: 50_000 });
    expect(await own(SYNCED + 1)).toEqual({ a: 50_000 });
  });

  it('coverage starting after the end, or no sync state → null, counted in missing and left out of totals', async () => {
    await account('late', 10_000, { oldest: kyivStartOfDay('2026-08-10') });
    await account('never', 5_000, { oldest: null });
    await account('ok', 7_000);
    const b = await balancesAt(db, { endSec: END_JULY });
    expect(Object.fromEntries(b.accounts.map((a) => [a.id, a.own_funds]))).toEqual({ late: null, never: null, ok: 7_000 });
    expect(b.missing).toBe(2);
    expect(b.totals).toEqual([{ currency: 980, own_funds: 7_000 }]);
  });

  it('a credit card: own funds against the current limit', async () => {
    await account('cc', 25_000, { creditLimit: 30_000 });
    await tx('cc', END_JULY - 100, -500, 28_000);
    await tx('cc', END_JULY + 100, -3_000, 25_000);
    expect(await own(END_JULY)).toEqual({ cc: -2_000 });
  });

  it('participantId keeps that participant\'s accounts only', async () => {
    // 'mine' first, on the sole (default) connection — created before another provider connection exists, so
    // ensureDefaultConnection does not later reuse it as "the only one" for 'her'.
    await account('mine', 1_000);
    const her = await addParticipant(db, { label: 'Вигадана' }, 0);
    const conn = await addConnection(db, her, 'monobank', 0);
    await account('hers', 2_000, { connection: conn });
    expect(Object.keys(await own(END_JULY, her))).toEqual(['hers']);
  });
});

describe('firstDataDate', () => {
  it('the Kyiv date of the oldest covered second; null without data', async () => {
    expect(await firstDataDate(db)).toBeNull();
    await account('a', 0, { oldest: Date.UTC(2025, 4, 31, 23, 30) / 1000 }); // 1 June 02:30 in Kyiv
    expect(await firstDataDate(db)).toBe('2025-06-01');
  });
});
