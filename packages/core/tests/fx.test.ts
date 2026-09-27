// Month rates of foreign currencies from the user's own exchanges (pair_fx rows on hryvnia accounts).
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Db } from '../src/db.ts';
import { kyivStartOfDay } from '../src/format.ts';
import { exchangeRates, toUah } from '../src/fx.ts';
import { insertAccountRow, memoryDb } from './helpers.ts';

let db: Db;
let seq = 0;
const USD = 840;
const EUR = 978;

async function acc(id: string, currency: number) {
  await insertAccountRow(db, { id, kind: 'card', type: 'fop', currency_code: currency, balance: 0, credit_limit: 0, updated_at: 0 });
}
/** One row; `date` Kyiv YYYY-MM-DD, time = noon of that day plus `o.timeOffsetSec` (default 0). */
async function row(accountId: string, date: string, amount: number, opCurrency: number, opAmount: number, o: { rule?: string | null; cancelled?: number; timeOffsetSec?: number } = {}) {
  await db.execute({
    sql: `INSERT INTO transactions (id, account_id, time, local_date, description, mcc, hold, amount, operation_amount, currency_code,
            is_cancelled, transfer_rule, raw_json, synced_at) VALUES (?, ?, ?, ?, '', 4829, 0, ?, ?, ?, ?, ?, '{}', 0)`,
    args: [`t${++seq}`, accountId, kyivStartOfDay(date) + 12 * 3600 + (o.timeOffsetSec ?? 0), date, amount, opAmount, opCurrency, o.cancelled ?? 0,
      o.rule === undefined ? 'pair_fx' : o.rule],
  });
}
const SEP = { from: '2026-09-01', to: '2026-09-30' };

beforeEach(async () => { seq = 0; db = await memoryDb(); await acc('uah', 980); await acc('usd', USD); });
afterEach(() => db.close());

describe('exchangeRates', () => {
  it('weights the month\'s sales: Σ hryvnia / Σ currency', async () => {
    await row('uah', '2026-09-05', 400_000, USD, 10_000); // 40.00
    await row('uah', '2026-09-20', 1_260_000, USD, 30_000); // 42.00
    await row('usd', '2026-09-05', -10_000, 980, -400_000); // the other half: never a source
    const r = await exchangeRates(db, SEP);
    expect(r.get(USD)).toEqual({ rate: 41.5, nearest: false });
  });

  it('no sale in the month → the nearest sale in time, before or after', async () => {
    await row('uah', '2026-08-25', 400_000, USD, 10_000); // 6 days before
    await row('uah', '2026-10-03', 420_000, USD, 10_000); // 3 days after — nearer
    expect((await exchangeRates(db, SEP)).get(USD)).toEqual({ rate: 42, nearest: true });
  });

  it('equal distance → the earlier sale', async () => {
    await row('uah', '2026-08-31', 400_000, USD, 10_000);
    await row('uah', '2026-10-01', 420_000, USD, 10_000);
    expect((await exchangeRates(db, SEP)).get(USD)).toEqual({ rate: 40, nearest: true });
  });

  it('purchases only when the currency was never sold', async () => {
    await row('uah', '2026-09-10', -520_000, EUR, -10_000); // bought € at 52.00
    await row('uah', '2026-09-11', -450_000, USD, -10_000); // bought $ at 45.00 …
    await row('uah', '2026-07-01', 400_000, USD, 10_000); // … but $ was sold once: the sale wins
    const r = await exchangeRates(db, SEP);
    expect(r.get(EUR)).toEqual({ rate: 52, nearest: false });
    expect(r.get(USD)).toEqual({ rate: 40, nearest: true });
  });

  it('skips cancelled rows, other rules and rows without an operation amount', async () => {
    await row('uah', '2026-09-05', 400_000, USD, 10_000, { cancelled: 1 });
    await row('uah', '2026-09-06', 400_000, USD, 10_000, { rule: 'family' });
    await row('uah', '2026-09-07', 400_000, USD, 10_000, { rule: null });
    await row('uah', '2026-09-08', 400_000, USD, 0);
    expect((await exchangeRates(db, SEP)).size).toBe(0);
  });

  it('a pair_fx row on a non-hryvnia account (a EUR↔USD exchange) is not a source', async () => {
    await row('usd', '2026-09-10', 9_000, EUR, 10_000); // USD account, operation currency EUR
    const r = await exchangeRates(db, SEP);
    expect(r.get(EUR)).toBeUndefined();
  });

  it('a sale on the month\'s last day counts as in-month', async () => {
    await row('uah', '2026-09-30', 420_000, USD, 10_000);
    expect((await exchangeRates(db, SEP)).get(USD)).toEqual({ rate: 42, nearest: false });
  });

  it('two sales the same day before the month → the later one (nearer in time) wins', async () => {
    await row('uah', '2026-08-25', 400_000, USD, 10_000, { timeOffsetSec: 0 });
    await row('uah', '2026-08-25', 410_000, USD, 10_000, { timeOffsetSec: 3600 });
    expect((await exchangeRates(db, SEP)).get(USD)).toEqual({ rate: 41, nearest: true });
  });

  it('toUah rounds to a kopeck; hryvnia passes through', () => {
    const rates = new Map([[USD, { rate: 44.355, nearest: false }]]);
    expect(toUah(316_200, USD, rates)).toBe(14_025_051);
    expect(toUah(5_000, 980, rates)).toBe(5_000);
    expect(toUah(5_000, EUR, rates)).toBeNull();
  });
});
