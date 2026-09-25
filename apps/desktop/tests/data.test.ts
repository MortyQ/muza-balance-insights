// The screen's read side in main: core aggregates → view types. Fictional fixtures only; canaries prove that
// names, descriptions, card numbers, IBANs and jar titles never reach the renderer.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Db } from '@mono/core/db';
import { kyivStartOfDay } from '@mono/core/format';
import { memoryDb } from '@mono/core/test-helpers';
import { DataService } from '../src/main/data.ts';

const NOW = kyivStartOfDay('2026-03-15') + 12 * 3600;
const SYNCED_TO = kyivStartOfDay('2026-03-10') + 23 * 3600;
const CANARIES = ['CANARY-NAME Ivanka Fictional', 'CANARY-DESC Shop Imaginary', 'UA00CANARY0000', '4444********0000', 'CANARY-JAR Dream'];

let db: Db;
let svc: DataService;
let seq = 0;

async function account(id: string, type: string | null, currency: number, balance: number, creditLimit = 0) {
  await db.execute({
    sql: `INSERT INTO accounts (id, kind, type, currency_code, iban, masked_pan, title, balance, credit_limit, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [id, type === null ? 'jar' : 'card', type, currency, CANARIES[2]!, JSON.stringify([CANARIES[3]]), CANARIES[4]!, balance, creditLimit, SYNCED_TO],
  });
}

async function tx(accountId: string, date: string, amount: number, category: string, o: { scope?: string; commission?: number } = {}) {
  await db.execute({
    sql: `INSERT INTO transactions (id, account_id, time, local_date, description, counter_name, mcc, hold, amount, operation_amount,
            currency_code, commission_rate, category, is_internal_transfer, scope, is_cancelled, raw_json, synced_at)
          VALUES (?, ?, ?, ?, ?, ?, 5411, 0, ?, ?, (SELECT currency_code FROM accounts WHERE id = ?), ?, ?, 0, ?, 0, '{}', 0)`,
    args: [`t${++seq}`, accountId, kyivStartOfDay(date) + 3600, date, CANARIES[1]!, CANARIES[0]!, amount, amount, accountId, o.commission ?? 0, category, o.scope ?? 'personal'],
  });
}

async function synced(accountId: string) {
  await db.execute({
    sql: 'INSERT INTO sync_state VALUES (?, ?, ?, ?)',
    args: [accountId, kyivStartOfDay('2026-01-01'), SYNCED_TO, SYNCED_TO + 60],
  });
}

beforeEach(async () => {
  seq = 0;
  db = await memoryDb();
  svc = new DataService({ open: async () => db, nowSec: () => NOW });
});
afterEach(() => db.close());

describe('DataService (main → renderer view types)', () => {
  it('spending: categories per account currency, net-sorted; currencies never summed; incomplete month flagged', async () => {
    await account('uah', 'black', 980, 100_000);
    await account('usd', 'black', 840, 5_000);
    await synced('uah');
    await synced('usd');
    await tx('uah', '2026-03-02', -30_000, 'продукты');
    await tx('uah', '2026-03-03', -50_000, 'кафе и рестораны');
    await tx('uah', '2026-03-04', 10_000, 'кафе и рестораны'); // refund
    await tx('usd', '2026-03-05', -2_500, 'путешествия');
    await tx('uah', '2026-02-20', -99_900, 'продукты'); // outside the month

    const v = await svc.spending({ from: '2026-03-01', to: '2026-03-31' });
    expect(v.period).toMatchObject({ from: '2026-03-01', to: '2026-03-31', days: 31, incomplete: true, dataUntil: '2026-03-10', coveredDays: 9 });
    expect(v.currencies.map((c) => c.currency)).toEqual([840, 980]);
    const uah = v.currencies.find((c) => c.currency === 980)!;
    expect(uah.categories).toEqual([
      { category: 'кафе и рестораны', gross: 50_000, refunds: 10_000, net: 40_000 },
      { category: 'продукты', gross: 30_000, refunds: 0, net: 30_000 },
    ]);
    expect(uah.total).toEqual({ category: '', gross: 80_000, refunds: 10_000, net: 70_000, netPerDay: Math.round(70_000 / 9) });
    expect(v.currencies.find((c) => c.currency === 840)!.total.net).toBe(2_500);
  });

  it('spending: scope filter and the commission split come from the core as is', async () => {
    await account('uah', 'black', 980, 0);
    await account('fop', 'fop', 980, 0);
    await synced('uah');
    await tx('uah', '2026-03-02', -10_000, 'продукты', { commission: 500 });
    await tx('fop', '2026-03-02', -70_000, 'налоги и госплатежи', { scope: 'business' });

    const personal = await svc.spending({ from: '2026-03-01', to: '2026-03-31', scope: 'personal' });
    expect(personal.currencies[0]!.categories).toEqual([
      { category: 'продукты', gross: 9_500, refunds: 0, net: 9_500 },
      { category: 'комиссии банка', gross: 500, refunds: 0, net: 500 },
    ]);
    const business = await svc.spending({ from: '2026-03-01', to: '2026-03-31', scope: 'business' });
    expect(business.currencies[0]!.categories.map((c) => c.category)).toEqual(['налоги и госплатежи']);
  });

  it('balances: cards and jars apart, own funds = balance − credit limit, totals per currency', async () => {
    await account('uah', 'black', 980, 150_000, 100_000);
    await account('usd', 'white', 840, 7_000);
    await account('jar1', null, 980, 20_000);
    await account('jar0', null, 980, 0); // empty, never synced → hidden (core rule)
    const b = await svc.balances();
    // Core order: by currency code, then id.
    expect(b.cards.map((c) => [c.label, c.ownFunds, c.creditLimit])).toEqual([
      ['white/USD', 7_000, 0],
      ['black/UAH', 50_000, 100_000],
    ]);
    // Two UAH jars exist (one hidden): the core disambiguates the label with the id prefix.
    expect(b.jars.map((j) => [j.label, j.ownFunds])).toEqual([['банка/UAH #jar1', 20_000]]);
    expect(b.totals).toEqual([
      { currency: 840, ownFunds: 7_000 },
      { currency: 980, ownFunds: 70_000 },
    ]);
  });

  it('status: empty database → no data; after an import → Kyiv date-time the data reaches', async () => {
    expect(await svc.status()).toEqual({ hasData: false, dataUntil: null, lastSyncAt: null });
    await account('uah', 'black', 980, 0);
    await synced('uah');
    expect(await svc.status()).toEqual({ hasData: true, dataUntil: '2026-03-10 23:00', lastSyncAt: '2026-03-10 23:01' });
  });

  it('nothing the renderer gets contains a name, description, card number, IBAN or jar title', async () => {
    await account('uah', 'black', 980, 1_000);
    await account('jar1', null, 980, 1_000);
    await synced('uah');
    await tx('uah', '2026-03-02', -10_000, 'переводы людям');
    const out = JSON.stringify([await svc.spending({ from: '2026-03-01', to: '2026-03-31' }), await svc.balances(), await svc.status()]);
    for (const c of CANARIES) expect(out).not.toContain(c);
    expect(out).not.toMatch(/CANARY|\*{4}|UA\d{2}/);
  });

  it('a failed open is not cached; close() lets the next call open a fresh connection', async () => {
    let opens = 0;
    const flaky = new DataService({
      open: async () => {
        opens += 1;
        if (opens === 1) throw new Error('locked');
        return db;
      },
      nowSec: () => NOW,
    });
    await expect(flaky.status()).rejects.toThrow('locked');
    await expect(flaky.status()).resolves.toMatchObject({ hasData: false });
    expect(opens).toBe(2);
  });
});
