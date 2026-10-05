// The screen's read side in main: core aggregates → view types. Fictional fixtures only; canaries prove that
// names, descriptions, card numbers, IBANs and jar titles never reach the renderer.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Db } from '@mono/core/db';
import { kyivStartOfDay, toKyivDateTime } from '@mono/core/format';
import { insertAccountRow, memoryDb } from '@mono/core/test-helpers';
import { last12Months } from '../src/main/category.ts';
import { DataService } from '../src/main/data.ts';
import type { RatesView } from '../src/shared/api.ts';
import { shiftDate } from '../src/main/now.ts';
import { inTimeZone } from './helpers/time-zone.ts';

const NOW = kyivStartOfDay('2026-03-15') + 12 * 3600;
const SYNCED_TO = kyivStartOfDay('2026-03-10') + 23 * 3600;
/** Today's fictional rates: 40.00 ₴ per $, 50.00 ₴ per €; nothing else quoted. */
const RATES: RatesView = { list: [{ currency: 840, rate: 40 }, { currency: 978, rate: 50 }], fetchedAt: NOW - 3600, saved: false };
const CANARIES = ['CANARY-NAME Ivanka Fictional', 'CANARY-DESC Shop Imaginary', 'UA00CANARY0000', '4444********0000', 'CANARY-JAR Dream'];

let db: Db;
let svc: DataService;
let seq = 0;
let rates: RatesView | null;
const todayRates = async () => rates;

async function account(id: string, type: string | null, currency: number, balance: number, creditLimit = 0) {
  await insertAccountRow(db, {
    id, kind: type === null ? 'jar' : 'card', type, currency_code: currency, iban: CANARIES[2]!, masked_pan: JSON.stringify([CANARIES[3]]),
    title: CANARIES[4]!, balance, credit_limit: creditLimit, updated_at: SYNCED_TO,
  });
}

type TxOpts = {
  scope?: string; commission?: number; balance?: number; mcc?: number;
  /** The bank's description (default — the description canary). */
  description?: string;
  /** The other side of an exchange: operation currency and amount (default — the account's own, = amount). */
  op?: { currency: number; amount: number };
  /** An own transfer: is_internal_transfer = 1 with this transfer_rule. */
  rule?: 'pair' | 'pair_fx';
  /** A transfer between two participants: transfer_rule = family, not internal (the core's marking). */
  family?: boolean;
};

async function tx(accountId: string, date: string, amount: number, category: string, o: TxOpts = {}) {
  await db.execute({
    sql: `INSERT INTO transactions (id, account_id, time, local_date, description, counter_name, mcc, hold, amount, operation_amount,
            currency_code, commission_rate, balance, category, is_internal_transfer, transfer_rule, scope, is_cancelled, raw_json, synced_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, COALESCE(?, (SELECT currency_code FROM accounts WHERE id = ?)), ?, ?, ?, ?, ?, ?, 0, '{}', 0)`,
    args: [
      `t${++seq}`, accountId, kyivStartOfDay(date) + 3600, date, o.description ?? CANARIES[1]!, CANARIES[0]!, o.mcc ?? 5411, amount, o.op?.amount ?? amount,
      o.op?.currency ?? null, accountId, o.commission ?? 0, o.balance ?? null, category, o.rule ? 1 : 0, o.rule ?? (o.family ? 'family' : null), o.scope ?? 'personal',
    ],
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
  rates = RATES;
  db = await memoryDb();
  svc = new DataService({ open: async () => db, release: async () => undefined, nowSec: () => NOW, rates: todayRates });
});
afterEach(() => db.close());

describe('DataService (main → renderer view types)', () => {
  it('status: empty database → no data; after an import → Kyiv date-time and date the data reaches / starts at', async () => {
    expect(await svc.status()).toEqual({ hasData: false, dataUntil: null, dataFrom: null, lastSyncAt: null });
    await account('uah', 'black', 980, 0);
    await synced('uah');
    expect(await svc.status()).toEqual({ hasData: true, dataUntil: '2026-03-10 23:00', dataFrom: '2026-01-01', lastSyncAt: '2026-03-10 23:01' });
  });

  it('lastSyncSec: null before any import, then the epoch seconds of the latest sync', async () => {
    expect(await svc.lastSyncSec()).toBeNull();
    await account('uah', 'black', 980, 0);
    await synced('uah');
    const at = await svc.lastSyncSec();
    expect(at).not.toBeNull();
    expect(toKyivDateTime(at!)).toBe((await svc.status()).lastSyncAt);
  });

  it('status and lastSyncSec count enabled accounts only: a disabled one with older coverage moves nothing', async () => {
    await account('uah', 'black', 980, 0);
    await account('old', 'white', 980, 0);
    await synced('uah');
    await db.execute({ sql: 'INSERT INTO sync_state VALUES (?, ?, ?, ?)', args: ['old', kyivStartOfDay('2025-06-01'), kyivStartOfDay('2025-07-01'), kyivStartOfDay('2025-07-01') + 60] });
    await db.execute(`UPDATE accounts SET sync_choice = 0 WHERE id = 'old'`);
    expect(await svc.status()).toEqual({ hasData: true, dataUntil: '2026-03-10 23:00', dataFrom: '2026-01-01', lastSyncAt: '2026-03-10 23:01' });
    expect(await svc.lastSyncSec()).toBe(SYNCED_TO + 60);

    // The last sync is only the disabled account's: auto-sync's gap reads from enabled ones.
    await db.execute(`UPDATE sync_state SET last_sync_at = ${SYNCED_TO + 3600} WHERE account_id = 'old'`);
    expect(await svc.lastSyncSec()).toBe(SYNCED_TO + 60);

    await db.execute(`UPDATE accounts SET sync_choice = 0 WHERE id = 'uah'`);
    expect(await svc.status()).toEqual({ hasData: false, dataUntil: null, dataFrom: null, lastSyncAt: null });
    expect(await svc.lastSyncSec()).toBeNull();
  });

  it('a failed open is not cached; close() lets the next call open a fresh connection', async () => {
    let opens = 0;
    const flaky = new DataService({
      open: async () => {
        opens += 1;
        if (opens === 1) throw new Error('locked');
        return db;
      },
      release: async () => undefined,
      nowSec: () => NOW,
      rates: todayRates,
    });
    await expect(flaky.status()).rejects.toThrow('locked');
    await expect(flaky.status()).resolves.toMatchObject({ hasData: false });
    expect(opens).toBe(2);
  });

  it('close() releases the closed files (Windows holds them until collected), after closing — also when nothing was open', async () => {
    const order: string[] = [];
    const conn = await memoryDb();
    const closing = new DataService({
      open: async () => ({ ...conn, close: () => (order.push('close'), conn.close()) }),
      release: async () => void order.push('release'),
      nowSec: () => NOW,
      rates: todayRates,
    });
    await closing.status();
    await closing.close();
    expect(order).toEqual(['close', 'release']);
    await closing.close();
    expect(order).toEqual(['close', 'release', 'release']);
  });
});

describe('DataService.monthOverview', () => {
  it('the current month: balanceAt "now", family total in hryvnia with dollars folded in at today\'s rate, income and spending of the month', async () => {
    await account('uah', 'black', 980, 100_000);
    await account('usd', 'black', 840, 5_000);
    await synced('uah');
    await synced('usd');
    await tx('uah', '2026-03-02', -30_000, 'продукты');
    await tx('uah', '2026-03-05', 20_000, 'поступления');
    await tx('usd', '2026-03-06', -1_000, 'путешествия');

    const v = await svc.monthOverview({ month: '2026-03' });
    expect(v.month).toBe('2026-03');
    expect(v.balanceAt).toBe('now');
    expect(v.coverage).toEqual({ from: '2026-03-01', to: '2026-03-10' });
    // Dollars fold into hryvnia at today's 40.00: own funds and spending alike; each foreign part listed with its rate.
    expect(v.total).toEqual({
      ownFunds: 100_000 + 5_000 * 40, others: [{ currency: 840, ownFunds: 5_000, rate: 40 }], missing: 0, accounts: 2, income: 20_000,
      spending: 30_000 + 1_000 * 40, fx: [{ currency: 840, income: 0, spending: 1_000, rate: 40 }],
    });
    expect(v.rates).toEqual(RATES);
    expect(v.accounts).toEqual([]);
    // Only one participant exists (the default "Я"): its own view matches the family total (no family transfers).
    expect(v.people).toHaveLength(1);
    expect(v.people[0]!.total).toEqual(v.total);
  });

  it('a past month: balanceAt is its last day, the balance comes from the last operation before its end', async () => {
    await account('uah', 'black', 980, 90_000);
    await synced('uah');
    await tx('uah', '2026-02-27', -5_000, 'продукты', { balance: 60_000 });
    await tx('uah', '2026-03-02', -10_000, 'продукты'); // after the month: does not affect its end balance

    const v = await svc.monthOverview({ month: '2026-02' });
    expect(v.balanceAt).toBe('2026-02-28');
    expect(v.coverage).toEqual({ from: '2026-02-01', to: '2026-02-28' });
    expect(v.total).toMatchObject({ ownFunds: 60_000, missing: 0, income: 0, spending: 5_000 });
  });

  it('a month before coverage: accounts have no data, missing counts them, the total excludes them; coverage never inverts', async () => {
    await account('uah', 'black', 980, 100_000);
    await synced('uah'); // covered from 2026-01-01 on only
    const me = Number((await db.execute('SELECT id FROM participants ORDER BY id LIMIT 1')).rows[0]?.id);

    const v = await svc.monthOverview({ month: '2025-11' });
    expect(v.total).toEqual({ ownFunds: 0, others: [], missing: 1, accounts: 1, income: 0, spending: 0, fx: [] });
    // Coverage starts in 2026-01 but the month asked for ends in 2025-11: from > to before clamping — clamp to = from.
    expect(v.coverage).toEqual({ from: '2026-01-01', to: '2026-01-01' });

    const person = await svc.monthOverview({ month: '2025-11', participantId: me });
    expect(person.accounts).toEqual([{ id: 'uah', name: { kind: 'card', type: 'black', currency: 980, tag: null }, kind: 'card', currency: 980, creditLimit: 0, ownFunds: null, income: 0, spending: 0 }]);
  });

  it('a month straddling the account\'s coverage start: balanceAt its last day, own funds from the backward calculation', async () => {
    await account('uah', 'black', 980, 70_000);
    await synced('uah'); // oldest = 2026-01-01: coverage starts exactly at December's end
    await tx('uah', '2026-01-05', -20_000, 'продукты'); // after December: reversed out of the current balance

    const v = await svc.monthOverview({ month: '2025-12' });
    expect(v.balanceAt).toBe('2025-12-31');
    expect(v.total).toMatchObject({ ownFunds: 90_000, missing: 0 });
  });

  it('the family: each person in the list with label and color, no accounts; a person: their accounts with income/spending', async () => {
    await account('mine', 'black', 980, 50_000);
    await synced('mine');
    const her = Number((await db.execute(`INSERT INTO participants (label, color, created_at) VALUES ('Вигадана', 'aqua', 0) RETURNING id`)).rows[0]?.id);
    const conn = Number((await db.execute({ sql: `INSERT INTO connections (participant_id, provider, created_at) VALUES (?, 'monobank', 0) RETURNING id`, args: [her] })).rows[0]?.id);
    await insertAccountRow(db, { id: 'hers', connection_id: conn, kind: 'card', type: 'white', currency_code: 980, balance: 20_000, updated_at: SYNCED_TO });
    await synced('hers');
    await tx('mine', '2026-03-02', -1_000, 'продукты');
    await tx('hers', '2026-03-03', -400, 'продукты');

    const family = await svc.monthOverview({ month: '2026-03' });
    expect(family.accounts).toEqual([]);
    expect(family.total).toMatchObject({ ownFunds: 70_000, spending: 1_400, accounts: 2 });
    expect(family.people).toHaveLength(2);
    const hersView = family.people.find((p) => p.participantId === her)!;
    expect(hersView).toMatchObject({ label: 'Вигадана', color: 'aqua', total: { ownFunds: 20_000, spending: 400, accounts: 1 } });
    const mineView = family.people.find((p) => p.participantId !== her)!;
    expect(mineView.total).toMatchObject({ ownFunds: 50_000, spending: 1_000, accounts: 1 });

    const person = await svc.monthOverview({ month: '2026-03', participantId: her });
    expect(person.people).toEqual([]);
    expect(person.accounts).toEqual([
      { id: 'hers', name: { kind: 'card', type: 'white', currency: 980, tag: null }, kind: 'card', currency: 980, creditLimit: 0, ownFunds: 20_000, income: 0, spending: 400 },
    ]);
  });

  /** FOP: $1 000.00 of income on the dollar account, sold for ₴ on `saleDate` at `saleUah` kopecks, ₴ sent on to the card. */
  async function fop(saleDate: string, saleUah: number) {
    await account('fopusd', 'fop', 840, 0);
    await account('fopuah', 'fop', 980, 0);
    await account('card', 'black', 980, 0);
    for (const a of ['fopusd', 'fopuah', 'card']) await synced(a);
    await tx('fopusd', '2026-03-03', 100_000, 'поступления', { scope: 'business' });
    await tx('fopusd', saleDate, -100_000, 'свои переводы', { scope: 'business', rule: 'pair_fx', op: { currency: 980, amount: -saleUah } });
    await tx('fopuah', saleDate, saleUah, 'свои переводы', { scope: 'business', rule: 'pair_fx', op: { currency: 840, amount: 100_000 } });
    await tx('fopuah', '2026-03-05', -saleUah, 'свои переводы', { scope: 'business', rule: 'pair' });
    await tx('card', '2026-03-05', saleUah, 'свои переводы', { rule: 'pair' });
    await tx('card', '2026-03-06', 20_000, 'поступления');
  }

  it('income and spending in dollars count in hryvnia at today\'s rate, whatever the month\'s exchanges were', async () => {
    await fop('2026-03-04', 3_800_000); // sold at 38.00 this month: not the rate the screen uses
    await tx('fopusd', '2026-03-07', -2_000, 'связь и цифровые сервисы', { scope: 'business' });
    const v = await svc.monthOverview({ month: '2026-03' });
    // The ₴ sent on to the card is not income.
    expect(v.total).toMatchObject({ income: 100_000 * 40 + 20_000, spending: 2_000 * 40 });
    expect(v.total.fx).toEqual([{ currency: 840, income: 100_000, spending: 2_000, rate: 40 }]);
  });

  it('no rates at all: foreign parts are left out (rate null), hryvnia counts as is; the answer says rates null', async () => {
    rates = null;
    await account('uah', 'black', 980, 30_000);
    await account('usd', 'black', 840, 5_000);
    for (const a of ['uah', 'usd']) await synced(a);
    await tx('uah', '2026-03-02', 20_000, 'поступления');
    await tx('uah', '2026-03-03', -1_000, 'продукты');
    await tx('usd', '2026-03-04', 10_000, 'поступления');
    await tx('usd', '2026-03-05', -700, 'кафе и рестораны');
    const v = await svc.monthOverview({ month: '2026-03' });
    expect(v.rates).toBeNull();
    expect(v.total).toMatchObject({ income: 20_000, spending: 1_000, ownFunds: 30_000, others: [{ currency: 840, ownFunds: 5_000, rate: null }] });
    expect(v.total.fx).toEqual([{ currency: 840, income: 10_000, spending: 700, rate: null }]);
  });

  it('a currency the bank does not quote is left out', async () => {
    await account('uah', 'black', 980, 0);
    await account('gbp', 'black', 826, 0);
    for (const a of ['uah', 'gbp']) await synced(a);
    await tx('uah', '2026-03-02', 20_000, 'поступления');
    await tx('gbp', '2026-03-03', 50_000, 'поступления');
    const v = await svc.monthOverview({ month: '2026-03' });
    expect(v.total.income).toBe(20_000);
    expect(v.total.fx).toEqual([{ currency: 826, income: 50_000, spending: 0, rate: null }]);
  });

  it('cash in euros with a commission: both count at today\'s rate, not the rate the euros were bought at', async () => {
    await account('uah', 'black', 980, 0);
    await account('eur', 'black', 978, 0);
    for (const a of ['uah', 'eur']) await synced(a);
    // €1 000.00 bought with hryvnia at 52.00.
    await tx('uah', '2026-03-02', -5_200_000, 'свои переводы', { rule: 'pair_fx', op: { currency: 978, amount: -100_000 } });
    await tx('eur', '2026-03-02', 100_000, 'свои переводы', { rule: 'pair_fx', op: { currency: 980, amount: 5_200_000 } });
    // Withdrawn €1 000.00 + €9.00 commission (the amount includes it).
    await tx('eur', '2026-03-04', -100_900, 'наличные', { mcc: 6011, commission: 900 });
    const v = await svc.monthOverview({ month: '2026-03' });
    expect(v.total.spending).toBe(100_900 * 50);
    expect(v.total.fx).toEqual([{ currency: 978, income: 0, spending: 100_900, rate: 50 }]);
  });

  it('balances: a dollar account folds into own funds at today\'s rate; others lists it with the rate', async () => {
    await account('uah', 'black', 980, 100_000);
    await account('usd', 'white', 840, 10_000);
    await account('gbp', 'black', 826, 7_000); // not quoted: listed, left out of ownFunds
    for (const a of ['uah', 'usd', 'gbp']) await synced(a);
    const me = Number((await db.execute('SELECT id FROM participants ORDER BY id LIMIT 1')).rows[0]?.id);

    const v = await svc.monthOverview({ month: '2026-03' });
    expect(v.total.ownFunds).toBe(100_000 + 10_000 * 40);
    expect(v.total.others).toEqual([
      { currency: 826, ownFunds: 7_000, rate: null },
      { currency: 840, ownFunds: 10_000, rate: 40 },
    ]);

    // A person's view: the same folding; each account keeps its own currency.
    const person = await svc.monthOverview({ month: '2026-03', participantId: me });
    expect(person.total.ownFunds).toBe(100_000 + 10_000 * 40);
    expect(person.rates).toEqual(RATES);
    expect(person.accounts.find((a) => a.id === 'usd')).toMatchObject({ currency: 840, ownFunds: 10_000 });
  });

  it('a dollar purchase refunded in full the same month: net zero, no income → nothing in fx', async () => {
    await account('uah', 'black', 980, 0);
    await account('usd', 'white', 840, 0);
    for (const a of ['uah', 'usd']) await synced(a);
    await tx('uah', '2026-03-02', -1_000, 'продукты');
    await tx('usd', '2026-03-03', -2_500, 'кафе и рестораны');
    await tx('usd', '2026-03-04', 2_500, 'кафе и рестораны'); // refund
    const v = await svc.monthOverview({ month: '2026-03' });
    expect(v.total).toMatchObject({ income: 0, spending: 1_000 });
    expect(v.total.fx).toEqual([]);
  });

  it('family and person: each person\'s card has its own fx at today\'s rate; account cards stay in their currency', async () => {
    await account('mine', 'black', 980, 0);
    await synced('mine');
    const her = Number((await db.execute(`INSERT INTO participants (label, color, created_at) VALUES ('Вигадана', 'aqua', 0) RETURNING id`)).rows[0]?.id);
    const conn = Number((await db.execute({ sql: `INSERT INTO connections (participant_id, provider, created_at) VALUES (?, 'monobank', 0) RETURNING id`, args: [her] })).rows[0]?.id);
    await insertAccountRow(db, { id: 'herusd', connection_id: conn, kind: 'card', type: 'white', currency_code: 840, balance: 0, updated_at: SYNCED_TO });
    await synced('herusd');
    await tx('mine', '2026-03-03', -1_000, 'продукты');
    await tx('herusd', '2026-03-04', -500, 'продукты');

    const family = await svc.monthOverview({ month: '2026-03' });
    expect(family.total).toMatchObject({ spending: 1_000 + 500 * 40, fx: [{ currency: 840, income: 0, spending: 500, rate: 40 }] });
    const hersView = family.people.find((p) => p.participantId === her)!;
    expect(hersView.total).toMatchObject({ spending: 500 * 40, fx: [{ currency: 840, income: 0, spending: 500, rate: 40 }] });
    expect(family.people.find((p) => p.participantId !== her)!.total).toMatchObject({ spending: 1_000, fx: [] });

    const person = await svc.monthOverview({ month: '2026-03', participantId: her });
    expect(person.total.fx).toEqual([{ currency: 840, income: 0, spending: 500, rate: 40 }]);
    expect(person.accounts).toEqual([
      { id: 'herusd', name: { kind: 'card', type: 'white', currency: 840, tag: null }, kind: 'card', currency: 840, creditLimit: 0, ownFunds: 0, income: 0, spending: 500 },
    ]);
  });

  it('nothing the renderer gets contains a name, description, card number, IBAN or jar title', async () => {
    await account('uah', 'black', 980, 1_000);
    await account('jar1', null, 980, 1_000);
    await synced('uah');
    await tx('uah', '2026-03-02', -10_000, 'переводы людям');
    const me = Number((await db.execute('SELECT id FROM participants ORDER BY id LIMIT 1')).rows[0]?.id);
    const out = JSON.stringify([
      await svc.spendingOverview({ month: '2026-03', scope: 'personal' }),
      await svc.monthOverview({ month: '2026-03' }),
      // The person view too: account labels (jar labels included) go through the same canary check.
      await svc.monthOverview({ month: '2026-03', participantId: me }),
      await svc.status(),
    ]);
    for (const c of CANARIES) expect(out).not.toContain(c);
    expect(out).not.toMatch(/CANARY|\*{4}|UA\d{2}/);
  });
});

describe('DataService: one participant or the whole family', () => {
  it('spendingOverview takes participantId; without it — everyone', async () => {
    await account('mine', 'black', 980, 10_000);
    const her = Number((await db.execute(`INSERT INTO participants (label, created_at) VALUES ('Вигадана', 0) RETURNING id`)).rows[0]?.id);
    const conn = Number((await db.execute({ sql: `INSERT INTO connections (participant_id, provider, created_at) VALUES (?, 'monobank', 0) RETURNING id`, args: [her] })).rows[0]?.id);
    await insertAccountRow(db, { id: 'hers', connection_id: conn, kind: 'card', type: 'white', currency_code: 980, balance: 3_000, updated_at: SYNCED_TO });
    await tx('mine', '2026-03-02', -1_000, 'продукты');
    await tx('hers', '2026-03-03', -400, 'продукты');
    for (const a of ['mine', 'hers']) await synced(a);
    const all = await svc.spendingOverview({ month: '2026-03', scope: 'personal' });
    const one = await svc.spendingOverview({ month: '2026-03', scope: 'personal', participantId: her });
    expect(all.total.net).toBe(1_400);
    expect(one.total.net).toBe(400);
  });
});

describe('DataService.spendingOverview', () => {
  it('one month: categories folded into hryvnia by today\'s rates, purchases, net-sorted, the rates echoed', async () => {
    await account('uah', 'black', 980, 100_000);
    await account('usd', 'black', 840, 5_000);
    await synced('uah');
    await synced('usd');
    await tx('uah', '2026-02-03', -30_000, 'продукты');
    await tx('uah', '2026-02-04', -10_000, 'продукты');
    await tx('uah', '2026-02-05', -50_000, 'кафе и рестораны');
    await tx('uah', '2026-02-06', 10_000, 'кафе и рестораны'); // refund: not an operation
    await tx('usd', '2026-02-07', -1_100, 'путешествия'); // $11.00 at 40.00

    const v = await svc.spendingOverview({ month: '2026-02', scope: 'personal' });
    expect(v.month).toBe('2026-02');
    expect(v.categories.map(({ category, categoryId, net, purchases }) => ({ category, categoryId, net, purchases }))).toEqual([
      { category: 'путешествия', categoryId: 'travel', net: 44_000, purchases: 1 },
      { category: 'кафе и рестораны', categoryId: 'cafes', net: 40_000, purchases: 1 },
      { category: 'продукты', categoryId: 'groceries', net: 40_000, purchases: 2 },
    ]);
    expect(v.total).toEqual({ net: 124_000, purchases: 4, prev: { net: 0, purchases: 0 } });
    expect(v.rates).toEqual(RATES);
    expect(v.leftOut).toEqual([]);
    expect(v.familyTotal).toBeNull();
  });

  it('a currency the bank does not quote stays out of the sums, listed in leftOut', async () => {
    await account('uah', 'black', 980, 0);
    await account('gbp', 'black', 826, 0);
    await synced('uah');
    await synced('gbp');
    await tx('uah', '2026-02-03', -30_000, 'продукты');
    await tx('gbp', '2026-02-07', -1_000, 'путешествия');
    const v = await svc.spendingOverview({ month: '2026-02', scope: 'personal' });
    expect(v.categories.map((c) => c.category)).toEqual(['продукты']);
    expect(v.total.net).toBe(30_000);
    expect(v.leftOut).toEqual([{ currency: 826, net: 1_000 }]);
  });

  it('no rates at all: every foreign currency is in leftOut, the answer says rates null', async () => {
    rates = null;
    await account('uah', 'black', 980, 0);
    await account('usd', 'black', 840, 0);
    for (const a of ['uah', 'usd']) await synced(a);
    await tx('uah', '2026-02-03', -30_000, 'продукты');
    await tx('usd', '2026-02-07', -1_000, 'путешествия');
    const v = await svc.spendingOverview({ month: '2026-02', scope: 'personal' });
    expect(v.rates).toBeNull();
    expect(v.total.net).toBe(30_000);
    expect(v.leftOut).toEqual([{ currency: 840, net: 1_000 }]);
  });

  it('spending: this month and the compared one fold by the same rate; rates echoed in the answer', async () => {
    await account('uah', 'black', 980, 0);
    await account('usd', 'black', 840, 0);
    for (const a of ['uah', 'usd']) await synced(a);
    // January's own exchange at 38.00, February's at 42.00: neither is the rate the block uses.
    await tx('uah', '2026-01-04', 38_000, 'свои переводы', { rule: 'pair_fx', op: { currency: 840, amount: -1_000 } });
    await tx('uah', '2026-02-04', 42_000, 'свои переводы', { rule: 'pair_fx', op: { currency: 840, amount: -1_000 } });
    await tx('usd', '2026-01-10', -1_000, 'путешествия');
    await tx('usd', '2026-02-10', -2_000, 'путешествия');
    const v = await svc.spendingOverview({ month: '2026-02', scope: 'personal' });
    expect(v.total).toEqual({ net: 2_000 * 40, purchases: 1, prev: { net: 1_000 * 40, purchases: 1 } });
    expect(v.categories[0]).toMatchObject({ net: 2_000 * 40, prev: { net: 1_000 * 40, purchases: 1 } });
    expect(v.rates).toEqual(RATES);
  });

  it('compare: the whole previous month; the same days while the month is in progress; none before the data', async () => {
    await account('uah', 'black', 980, 0);
    await synced('uah');
    await tx('uah', '2026-01-10', -20_000, 'продукты');
    await tx('uah', '2026-02-05', -30_000, 'продукты');
    await tx('uah', '2026-02-20', -5_000, 'продукты'); // after the 10th: out of March's comparison
    await tx('uah', '2026-03-02', -7_000, 'продукты');

    const feb = await svc.spendingOverview({ month: '2026-02', scope: 'personal' });
    expect(feb.compare).toEqual({ from: '2026-01-01', to: '2026-01-31', partial: false });
    expect(feb.categories[0]).toMatchObject({ net: 35_000, purchases: 2, prev: { net: 20_000, purchases: 1 } });
    expect(feb.total.prev).toEqual({ net: 20_000, purchases: 1 });

    const mar = await svc.spendingOverview({ month: '2026-03', scope: 'personal' });
    expect(mar.compare).toEqual({ from: '2026-02-01', to: '2026-02-10', partial: true });
    expect(mar.total.prev).toEqual({ net: 30_000, purchases: 1 });

    const jan = await svc.spendingOverview({ month: '2026-01', scope: 'personal' });
    expect(jan.compare).toBeNull();
    expect(jan.total.prev).toBeNull();
    expect(jan.categories[0]!.prev).toBeNull();
  });

  it('family: each person part per category adds up to the total; a person view has no parts but the family total', async () => {
    await account('uah', 'black', 980, 0);
    await synced('uah');
    const her = Number((await db.execute(`INSERT INTO participants (label, color, created_at) VALUES ('Вигадана', 'aqua', 0) RETURNING id`)).rows[0]?.id);
    const conn = Number((await db.execute({ sql: `INSERT INTO connections (participant_id, provider, created_at) VALUES (?, 'monobank', 0) RETURNING id`, args: [her] })).rows[0]?.id);
    await insertAccountRow(db, { id: 'hers', connection_id: conn, kind: 'card', type: 'white', currency_code: 980, balance: 0, updated_at: SYNCED_TO });
    await synced('hers');
    const me = Number((await db.execute('SELECT id FROM participants ORDER BY id LIMIT 1')).rows[0]?.id);
    await tx('uah', '2026-02-03', -30_000, 'продукты');
    await tx('hers', '2026-02-04', -20_000, 'продукты');
    await tx('hers', '2026-02-05', -5_000, 'кафе и рестораны');

    const family = await svc.spendingOverview({ month: '2026-02', scope: 'personal' });
    expect(family.categories.map((c) => [c.category, c.people.map((p) => [p.participantId, p.net, p.purchases])])).toEqual([
      ['продукты', [[me, 30_000, 1], [her, 20_000, 1]]],
      ['кафе и рестораны', [[me, 0, 0], [her, 5_000, 1]]],
    ]);
    expect(family.people.map((p) => [p.participantId, p.net, p.purchases])).toEqual([[me, 30_000, 1], [her, 25_000, 2]]);
    expect(family.people.reduce((s, p) => s + p.net, 0)).toBe(family.total.net);
    expect(family.familyTotal).toBeNull();

    const person = await svc.spendingOverview({ month: '2026-02', scope: 'personal', participantId: her });
    expect(person.categories.every((c) => c.people.length === 0)).toBe(true);
    expect(person.people).toEqual([]);
    expect(person.total.net).toBe(25_000);
    expect(person.familyTotal).toBe(55_000);
  });

  it('a family transfer: the sender\'s spending in their own view, out of the family view; the people still add up', async () => {
    await account('uah', 'black', 980, 0);
    await synced('uah');
    const her = Number((await db.execute(`INSERT INTO participants (label, color, created_at) VALUES ('Вигадана', 'aqua', 0) RETURNING id`)).rows[0]?.id);
    const conn = Number((await db.execute({ sql: `INSERT INTO connections (participant_id, provider, created_at) VALUES (?, 'monobank', 0) RETURNING id`, args: [her] })).rows[0]?.id);
    await insertAccountRow(db, { id: 'hers', connection_id: conn, kind: 'card', type: 'white', currency_code: 980, balance: 0, updated_at: SYNCED_TO });
    await synced('hers');
    const me = Number((await db.execute('SELECT id FROM participants ORDER BY id LIMIT 1')).rows[0]?.id);
    await tx('uah', '2026-02-03', -30_000, 'продукты');
    await tx('hers', '2026-02-04', -20_000, 'продукты');
    await tx('uah', '2026-02-05', -15_000, 'семье', { family: true });
    await tx('hers', '2026-02-05', 15_000, 'поступления', { family: true });

    const mine = await svc.spendingOverview({ month: '2026-02', scope: 'personal', participantId: me });
    expect(mine.categories.map((c) => [c.category, c.net])).toEqual([['продукты', 30_000], ['семье', 15_000]]);
    expect(mine.total.net).toBe(45_000);

    const family = await svc.spendingOverview({ month: '2026-02', scope: 'personal' });
    expect(family.categories.map((c) => c.category)).toEqual(['продукты']);
    expect(family.total.net).toBe(50_000);
    expect(family.people.map((p) => [p.participantId, p.net])).toEqual([[me, 30_000], [her, 20_000]]);
    expect(family.people.reduce((s, p) => s + p.net, 0)).toBe(family.total.net);
  });

  it('a refund-only category is not listed, but its net counts in the total', async () => {
    await account('uah', 'black', 980, 0);
    await synced('uah');
    await tx('uah', '2026-02-03', -30_000, 'продукты');
    await tx('uah', '2026-02-04', 4_000, 'кафе и рестораны'); // refund of a January purchase
    const v = await svc.spendingOverview({ month: '2026-02', scope: 'personal' });
    expect(v.categories.map((c) => c.category)).toEqual(['продукты']);
    expect(v.total).toMatchObject({ net: 26_000, purchases: 1 });
  });

  it('scope: business spending only in the business view', async () => {
    await account('uah', 'black', 980, 0);
    await account('fop', 'fop', 980, 0);
    await synced('uah');
    await synced('fop');
    await tx('uah', '2026-02-03', -30_000, 'продукты');
    await tx('fop', '2026-02-03', -70_000, 'налоги и госплатежи', { scope: 'business' });
    expect((await svc.spendingOverview({ month: '2026-02', scope: 'business' })).categories.map((c) => c.category)).toEqual(['налоги и госплатежи']);
  });

  it('never carries names, descriptions, card numbers, IBANs or jar titles', async () => {
    await account('uah', 'black', 980, 0);
    await synced('uah');
    await tx('uah', '2026-02-03', -30_000, 'продукты');
    const json = JSON.stringify(await svc.spendingOverview({ month: '2026-02', scope: 'personal' }));
    for (const c of CANARIES) expect(json).not.toContain(c);
  });
});

describe('DataService.nowOverview', () => {
  // Tuesday 2026-03-10, 23:30 Kyiv: after the sync (23:00), so Monday 03-09 is the last fully covered day.
  const NOW_STRIP = kyivStartOfDay('2026-03-10') + 23 * 3600 + 30 * 60;
  const at = () => new DataService({ open: async () => db, release: async () => undefined, nowSec: () => NOW_STRIP, rates: todayRates });

  async function fixture() {
    await account('uah', 'black', 980, 0);
    await account('usd', 'black', 840, 0);
    await account('fop', 'fop', 980, 0);
    for (const id of ['uah', 'usd', 'fop']) await synced(id);
    // 1 000 every day 02-08 … 03-09: the usual day.
    for (let i = 0; i < 30; i++) await tx('uah', shiftDate('2026-02-08', i), -1_000, 'продукты');
    await tx('uah', '2026-03-02', -5_000, 'кафе и рестораны'); // last Monday
    await tx('uah', '2026-03-03', -7_000, 'кафе и рестораны'); // last Tuesday
    await tx('uah', '2026-03-04', -100_000, 'путешествия'); // last Wednesday: outside the comparison
    // An own sale at 41.00 this month: the strip still folds by today's 40.00.
    await tx('uah', '2026-03-05', 41_000, 'свои переводы', { rule: 'pair_fx', op: { currency: 840, amount: -1_000 } });
    await tx('uah', '2026-03-09', -20_000, 'продукты');
    await tx('usd', '2026-03-09', -100, 'путешествия'); // 1 $ → 4 000
    await tx('fop', '2026-03-09', -50_000, 'налоги и госплатежи', { scope: 'business' }); // not in the strip
    await tx('uah', '2026-03-10', -12_000, 'продукты');
    await tx('uah', '2026-03-10', -3_000, 'кафе и рестораны');
  }

  it('today, the usual day, the week, last week, the top category and its rank this month, rates', async () => {
    await fixture();
    expect(await at().nowOverview({})).toEqual({
      date: '2026-03-10',
      weekday: 2,
      dataUntil: '2026-03-10',
      today: { net: 15_000, purchases: 2 },
      // 26 days of 1 000 and 6 000, 8 000, 101 000, 25 000 → the middle two are 1 000
      usualDay: 1_000,
      week: {
        from: '2026-03-09',
        days: [25_000, 15_000, null, null, null, null, null],
        total: { net: 40_000, purchases: 5 },
        prev: 14_000,
        // March: travel 104 000, groceries 41 000, cafes 15 000 → groceries is second
        top: { category: 'продукты', categoryId: 'groceries', net: 33_000, purchases: 3, rank: 1 },
        pendingHolds: 0,
      },
      rates: RATES,
    });
  });

  it('now strip: without rates the dollar purchase is left out, the answer says rates null', async () => {
    await fixture();
    rates = null;
    const v = await at().nowOverview({});
    expect(v.rates).toBeNull();
    expect(v.week.days.slice(0, 2)).toEqual([21_000, 15_000]);
    expect(v.week.total.net).toBe(36_000);
  });

  it('pending holds of the week', async () => {
    await fixture();
    await db.execute(`UPDATE transactions SET hold = 1 WHERE account_id = 'uah' AND local_date = '2026-03-10'`);
    expect((await at().nowOverview({})).week.pendingHolds).toBe(2);
  });

  it('a stale sync clips last week to the day the data reaches', async () => {
    // Thursday 2026-03-12, 10:00 Kyiv; the data reaches only Tuesday 2026-03-10 (two days behind).
    const STALE_NOW = kyivStartOfDay('2026-03-12') + 10 * 3600;
    const dataEnds = kyivStartOfDay('2026-03-11') - 1;
    const stale = () => new DataService({ open: async () => db, release: async () => undefined, nowSec: () => STALE_NOW, rates: todayRates });
    await account('uah', 'black', 980, 0);
    await db.execute({ sql: 'INSERT INTO sync_state VALUES (?, ?, ?, ?)', args: ['uah', kyivStartOfDay('2026-01-01'), dataEnds, dataEnds] });
    await tx('uah', '2026-03-02', -1_000, 'продукты'); // last Monday: inside [Mon, reach − 7]
    await tx('uah', '2026-03-03', -2_000, 'продукты'); // last Tuesday: the data reaches this weekday too
    await tx('uah', '2026-03-04', -4_000, 'продукты'); // last Wednesday: the data does not reach Wednesday — excluded
    const v = await stale().nowOverview({});
    expect(v.dataUntil).toBe('2026-03-10');
    expect(v.week.from).toBe('2026-03-09');
    expect(v.week.prev).toBe(3_000); // last Monday + last Tuesday only, not last Wednesday
  });

  it('data that starts late: no usual day (under 7 covered days), no last week', async () => {
    await account('uah', 'black', 980, 0);
    await db.execute({ sql: 'INSERT INTO sync_state VALUES (?, ?, ?, ?)', args: ['uah', kyivStartOfDay('2026-03-05'), SYNCED_TO, SYNCED_TO + 60] });
    await tx('uah', '2026-03-10', -3_000, 'продукты');
    const v = await at().nowOverview({});
    expect(v.usualDay).toBeNull();
    expect(v.week.prev).toBeNull();
    expect(v.today).toEqual({ net: 3_000, purchases: 1 });
  });

  it('one person: only their accounts; the family: everyone', async () => {
    await fixture();
    const her = Number((await db.execute(`INSERT INTO participants (label, color, created_at) VALUES ('Вигадана', 'aqua', 0) RETURNING id`)).rows[0]?.id);
    const conn = Number((await db.execute({ sql: `INSERT INTO connections (participant_id, provider, created_at) VALUES (?, 'monobank', 0) RETURNING id`, args: [her] })).rows[0]?.id);
    await insertAccountRow(db, { id: 'hers', connection_id: conn, kind: 'card', type: 'white', currency_code: 980, balance: 0, updated_at: SYNCED_TO });
    await synced('hers');
    await tx('hers', '2026-03-10', -9_000, 'продукты');

    expect((await at().nowOverview({})).today).toEqual({ net: 24_000, purchases: 3 });
    const mine = await at().nowOverview({ participantId: her });
    expect(mine.today).toEqual({ net: 9_000, purchases: 1 });
    expect(mine.usualDay).toBe(0);
    expect(mine.week.top).toEqual({ category: 'продукты', categoryId: 'groceries', net: 9_000, purchases: 1, rank: 0 });
  });

  it('an empty week: no top category, zeros', async () => {
    await account('uah', 'black', 980, 0);
    await synced('uah');
    const v = await at().nowOverview({});
    expect(v.week.top).toBeNull();
    expect(v.week.total).toEqual({ net: 0, purchases: 0 });
    expect(v.today).toEqual({ net: 0, purchases: 0 });
  });

  it('Monday NOW: the week is just today, prev is last Monday alone', async () => {
    // Monday 2026-03-16, 23:59:59 Kyiv, data synced through this very second: the whole day counts as covered.
    const MONDAY_NOW = kyivStartOfDay('2026-03-16') + 86_399;
    const monday = () => new DataService({ open: async () => db, release: async () => undefined, nowSec: () => MONDAY_NOW, rates: todayRates });
    await account('uah', 'black', 980, 0);
    await db.execute({ sql: 'INSERT INTO sync_state VALUES (?, ?, ?, ?)', args: ['uah', kyivStartOfDay('2026-01-01'), MONDAY_NOW, MONDAY_NOW] });
    await tx('uah', '2026-03-09', -2_000, 'продукты'); // last Monday
    await tx('uah', '2026-03-16', -5_000, 'продукты'); // today
    const v = await monday().nowOverview({});
    expect(v.weekday).toBe(1);
    expect(v.week.from).toBe('2026-03-16');
    expect(v.week.days).toEqual([5_000, null, null, null, null, null, null]);
    expect(v.week.prev).toBe(2_000);
  });

  it('Sunday NOW: the week has no nulls (today is the last weekday)', async () => {
    const SUNDAY_NOW = kyivStartOfDay('2026-03-15') + 12 * 3600; // Sunday 2026-03-15, noon
    const sunday = () => new DataService({ open: async () => db, release: async () => undefined, nowSec: () => SUNDAY_NOW, rates: todayRates });
    await account('uah', 'black', 980, 0);
    await synced('uah');
    const v = await sunday().nowOverview({});
    expect(v.weekday).toBe(7);
    expect(v.week.days).toHaveLength(7);
    expect(v.week.days).not.toContain(null);
  });

  it('never carries names, descriptions, card numbers, IBANs or jar titles', async () => {
    await fixture();
    const json = JSON.stringify(await at().nowOverview({}));
    for (const c of CANARIES) expect(json).not.toContain(c);
  });
});

describe('DataService in the system time zone, not Kyiv', () => {
  const service = (nowSec: number) => new DataService({ open: async () => db, release: async () => undefined, nowSec: () => nowSec, rates: todayRates });

  describe('Europe/Berlin', () => {
    inTimeZone('Europe/Berlin');

    it('now strip: Monday 23:10 in Berlin is still Monday (Kyiv is already on Tuesday)', async () => {
      await account('uah', 'black', 980, 0);
      await synced('uah');
      await tx('uah', '2026-03-16', -5_000, 'продукты');
      const v = await service(Date.UTC(2026, 2, 16, 22, 10) / 1000).nowOverview({});
      expect(v.date).toBe('2026-03-16');
      expect(v.weekday).toBe(1);
      expect(v.week.from).toBe('2026-03-16');
      expect(v.today).toEqual({ net: 5_000, purchases: 1 });
    });

    it('status: the times and the first date on the Berlin clock', async () => {
      await account('uah', 'black', 980, 0);
      await synced('uah');
      // SYNCED_TO is 23:00 in Kyiv = 22:00 in Berlin; the data starts at 00:00 on 1 Jan in Kyiv = 23:00 on 31 Dec in Berlin.
      expect(await svc.status()).toEqual({ hasData: true, dataUntil: '2026-03-10 22:00', dataFrom: '2025-12-31', lastSyncAt: '2026-03-10 22:01' });
    });

    it('month overview: at 23:10 on the month\'s last day the month is still the current one (balance «now»)', async () => {
      await account('uah', 'black', 980, 0);
      await synced('uah');
      // 31 Mar 2026, 23:10 in Berlin (CEST) = 00:10 on 1 Apr in Kyiv.
      const v = await service(Date.UTC(2026, 2, 31, 21, 10) / 1000).monthOverview({ month: '2026-03' });
      expect(v.balanceAt).toBe('now');
    });

    it('spending: a purchase at 23:30 in Berlin on 31 Mar counts for March, though its Kyiv date is 1 Apr', async () => {
      await account('uah', 'black', 980, 0);
      await synced('uah');
      await tx('uah', '2026-04-01', -5_000, 'продукты');
      await db.execute({ sql: 'UPDATE transactions SET time = ? WHERE id = ?', args: [Date.UTC(2026, 2, 31, 21, 30) / 1000, `t${seq}`] });
      const s = service(Date.UTC(2026, 3, 10, 10, 0) / 1000);
      const groceries = async (month: string) =>
        (await s.spendingOverview({ month, scope: 'personal' })).categories.find((c) => c.category === 'продукты')?.net ?? 0;
      expect(await groceries('2026-03')).toBe(5_000);
      expect(await groceries('2026-04')).toBe(0);
    });
  });

  describe('America/Bogota (UTC−5)', () => {
    inTimeZone('America/Bogota');

    it('now strip: Sunday 21:00 is still Sunday (Kyiv is already on Monday morning)', async () => {
      await account('uah', 'black', 980, 0);
      await synced('uah');
      const v = await service(Date.UTC(2026, 2, 16, 2, 0) / 1000).nowOverview({});
      expect(v.date).toBe('2026-03-15');
      expect(v.weekday).toBe(7);
      expect(v.week.from).toBe('2026-03-09');
    });
  });
});

describe('DataService.categoryOverview (the category screen)', () => {
  const TAXI = 'такси и транспорт';
  beforeEach(async () => {
    await account('uah', 'black', 980, 0);
    await account('usd', 'white', 840, 0);
    await account('jar1', null, 980, 0);
    for (const id of ['uah', 'usd']) await synced(id);
    await tx('uah', '2026-02-10', -3_000, TAXI, { description: 'Vigadane Taxi' });
    await tx('uah', '2026-03-02', -10_000, TAXI, { description: 'Vigadane Taxi' }); // a Monday
    await tx('uah', '2026-03-06', -4_000, TAXI, { description: 'VIGADANE  taxi', commission: 500 }); // a Friday
    await tx('uah', '2026-03-07', 1_000, TAXI, { description: 'Vigadane Taxi' }); // a refund
    await tx('usd', '2026-03-08', -500, TAXI, { description: 'Imaginary Metro' }); // 5 $ = 200 ₴
    await tx('uah', '2026-03-09', -20_000, 'продукты', { description: 'Vigadanyi Market' });
  });

  it('the figure is the spending block\'s; the lines sum to it; share, rank, last month, 12 months', async () => {
    const v = await svc.categoryOverview({ month: '2026-03', category: 'transport', scope: 'personal' });
    const block = (await svc.spendingOverview({ month: '2026-03', scope: 'personal' })).categories.find((c) => c.category === TAXI)!;
    expect(v.category).toBe(TAXI);
    expect(v.summary).toMatchObject({ net: block.net, purchases: block.purchases, gross: 3_500 + 10_000 + 20_000, refunds: 1_000 });
    expect(v.summary.net).toBe(32_500);
    expect(-v.lines.reduce((s, l) => s + (l.uah ?? 0), 0)).toBe(v.summary.net);
    // The scope's spending: transport 32 500, groceries 20 000, the 500 fee.
    expect(v.summary).toMatchObject({ rank: 1, share: 32_500 / 53_000, prev: { net: 3_000, purchases: 1 }, activeDays: 3, largest: 't5' });
    expect(v.months.at(-1)).toEqual({ month: '2026-03', net: 32_500 });
    expect(v.months.at(-2)).toEqual({ month: '2026-02', net: 3_000 });
    expect(v.months[0]).toEqual({ month: '2025-04', net: null }); // before the data
    expect(v.thisMonth).toBe('2026-03');
    expect(v.leftOut).toEqual([]);
  });

  it('12 months reach today while the picked month is among them, else end with it', async () => {
    const recent = await svc.categoryOverview({ month: '2026-02', category: 'transport', scope: 'personal' });
    expect(recent.months.map((m) => m.month)).toEqual(last12Months('2026-03'));
    expect(recent.months.at(-1)).toEqual({ month: '2026-03', net: 32_500 });
    const old = await svc.categoryOverview({ month: '2025-03', category: 'transport', scope: 'personal' });
    expect(old.months.map((m) => m.month)).toEqual(last12Months('2025-03'));
  });

  it('lines: newest first, the commission apart, refund and foreign-currency marks, local date and weekday', async () => {
    const v = await svc.categoryOverview({ month: '2026-03', category: 'transport', scope: 'personal' });
    expect(v.lines.map((l) => [l.key, l.date, l.weekday, l.uah, l.refund, l.commission])).toEqual([
      ['t5', '2026-03-08', 7, -20_000, false, false],
      ['t4', '2026-03-07', 6, 1_000, true, false],
      ['t3', '2026-03-06', 5, -3_500, false, false],
      ['t2', '2026-03-02', 1, -10_000, false, false],
    ]);
    expect(v.lines[0]).toMatchObject({ currency: 840, amount: -500, account: { kind: 'card', type: 'white', currency: 840 }, time: '01:00' });
    const fees = await svc.categoryOverview({ month: '2026-03', category: 'fees', scope: 'personal' });
    expect(fees.lines.map((l) => [l.key, l.uah, l.commission])).toEqual([['t3:fee', -500, true]]);
  });

  it('where: merchants case-insensitively; one person — no people', async () => {
    const v = await svc.categoryOverview({ month: '2026-03', category: 'transport', scope: 'personal' });
    expect(v.merchants).toEqual([
      { name: 'Imaginary Metro', net: 20_000, purchases: 1 },
      { name: 'Vigadane Taxi', net: 12_500, purchases: 2 },
    ]);
    expect(v.people).toEqual([]); // one person
  });

  it('the description and comment reach the renderer here only — never a name, card number, IBAN or jar title', async () => {
    await tx('uah', '2026-03-03', -700, TAXI, { description: 'Taxi to 537541******1234 via CANARY-JAR Dream' });
    const v = await svc.categoryOverview({ month: '2026-03', category: 'transport', scope: 'personal' });
    expect(v.lines.find((l) => l.key === `t${seq}`)?.merchant).toBe('Taxi to •• 1234 via •••');
    await tx('uah', '2026-03-04', -100, TAXI);
    const json = JSON.stringify(await svc.categoryOverview({ month: '2026-03', category: 'transport', scope: 'personal' }));
    expect(json).toContain(CANARIES[1]);
    for (const c of [CANARIES[0], CANARIES[2], CANARIES[3], CANARIES[4]]) expect(json).not.toContain(c);
    expect(json).not.toMatch(/\*{4}|UA\d{2}/);
  });
});
