// The screen's read side in main: core aggregates → view types. Fictional fixtures only; canaries prove that
// names, descriptions, card numbers, IBANs and jar titles never reach the renderer.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Db } from '@mono/core/db';
import { kyivStartOfDay, toKyivDateTime } from '@mono/core/format';
import { insertAccountRow, memoryDb } from '@mono/core/test-helpers';
import { DataService } from '../src/main/data.ts';

const NOW = kyivStartOfDay('2026-03-15') + 12 * 3600;
const SYNCED_TO = kyivStartOfDay('2026-03-10') + 23 * 3600;
const CANARIES = ['CANARY-NAME Ivanka Fictional', 'CANARY-DESC Shop Imaginary', 'UA00CANARY0000', '4444********0000', 'CANARY-JAR Dream'];

let db: Db;
let svc: DataService;
let seq = 0;

async function account(id: string, type: string | null, currency: number, balance: number, creditLimit = 0) {
  await insertAccountRow(db, {
    id, kind: type === null ? 'jar' : 'card', type, currency_code: currency, iban: CANARIES[2]!, masked_pan: JSON.stringify([CANARIES[3]]),
    title: CANARIES[4]!, balance, credit_limit: creditLimit, updated_at: SYNCED_TO,
  });
}

type TxOpts = {
  scope?: string; commission?: number; balance?: number; mcc?: number;
  /** The other side of an exchange: operation currency and amount (default — the account's own, = amount). */
  op?: { currency: number; amount: number };
  /** An own transfer: is_internal_transfer = 1 with this transfer_rule. */
  rule?: 'pair' | 'pair_fx';
};

async function tx(accountId: string, date: string, amount: number, category: string, o: TxOpts = {}) {
  await db.execute({
    sql: `INSERT INTO transactions (id, account_id, time, local_date, description, counter_name, mcc, hold, amount, operation_amount,
            currency_code, commission_rate, balance, category, is_internal_transfer, transfer_rule, scope, is_cancelled, raw_json, synced_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, COALESCE(?, (SELECT currency_code FROM accounts WHERE id = ?)), ?, ?, ?, ?, ?, ?, 0, '{}', 0)`,
    args: [
      `t${++seq}`, accountId, kyivStartOfDay(date) + 3600, date, CANARIES[1]!, CANARIES[0]!, o.mcc ?? 5411, amount, o.op?.amount ?? amount,
      o.op?.currency ?? null, accountId, o.commission ?? 0, o.balance ?? null, category, o.rule ? 1 : 0, o.rule ?? null, o.scope ?? 'personal',
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
  db = await memoryDb();
  svc = new DataService({ open: async () => db, release: async () => undefined, nowSec: () => NOW });
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
      { category: 'кафе и рестораны', categoryId: 'cafes', gross: 50_000, refunds: 10_000, net: 40_000 },
      { category: 'продукты', categoryId: 'groceries', gross: 30_000, refunds: 0, net: 30_000 },
    ]);
    expect(uah.total).toEqual({ category: '', categoryId: null, gross: 80_000, refunds: 10_000, net: 70_000, netPerDay: Math.round(70_000 / 9) });
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
      { category: 'продукты', categoryId: 'groceries', gross: 9_500, refunds: 0, net: 9_500 },
      { category: 'комиссии банка', categoryId: 'fees', gross: 500, refunds: 0, net: 500 },
    ]);
    const business = await svc.spending({ from: '2026-03-01', to: '2026-03-31', scope: 'business' });
    expect(business.currencies[0]!.categories.map((c) => c.category)).toEqual(['налоги и госплатежи']);
  });

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
    });
    await closing.status();
    await closing.close();
    expect(order).toEqual(['close', 'release']);
    await closing.close();
    expect(order).toEqual(['close', 'release', 'release']);
  });
});

describe('DataService.monthOverview', () => {
  it('the current month: balanceAt "now", family total in hryvnia, other currencies apart, income and spending of the month', async () => {
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
    // No exchange of dollars at all: the dollar spending is listed apart and left out of the hryvnia sum.
    expect(v.total).toEqual({
      ownFunds: 100_000, others: [{ currency: 840, ownFunds: 5_000 }], missing: 0, accounts: 2, income: 20_000, spending: 30_000,
      fx: [{ currency: 840, income: 0, spending: 1_000, rate: null, nearest: false }],
    });
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
    expect(person.accounts).toEqual([{ id: 'uah', label: 'black/UAH', kind: 'card', currency: 980, creditLimit: 0, ownFunds: null, income: 0, spending: 0 }]);
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
      { id: 'hers', label: 'white/UAH', kind: 'card', currency: 980, creditLimit: 0, ownFunds: 20_000, income: 0, spending: 400 },
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

  it('income in dollars counts in hryvnia at the month\'s own sale rate; the ₴ sent on to the card is not income', async () => {
    await fop('2026-03-04', 4_100_000); // 41.00
    const v = await svc.monthOverview({ month: '2026-03' });
    expect(v.total).toMatchObject({ income: 100_000 * 41 + 20_000, spending: 0 });
    expect(v.total.fx).toEqual([{ currency: 840, income: 100_000, spending: 0, rate: 41, nearest: false }]);
  });

  it('no sale in the month → the nearest one\'s rate, flagged nearest', async () => {
    await fop('2026-02-20', 4_000_000); // 40.00, in February
    const v = await svc.monthOverview({ month: '2026-03' });
    expect(v.total.income).toBe(100_000 * 40 + 20_000);
    expect(v.total.fx).toEqual([{ currency: 840, income: 100_000, spending: 0, rate: 40, nearest: true }]);
  });

  it('spending in dollars counts in hryvnia at the same rate', async () => {
    await fop('2026-03-04', 4_100_000);
    await tx('fopusd', '2026-03-07', -1_000, 'связь и цифровые сервисы', { scope: 'business' });
    const v = await svc.monthOverview({ month: '2026-03' });
    expect(v.total.spending).toBe(1_000 * 41);
    expect(v.total.fx).toEqual([{ currency: 840, income: 100_000, spending: 1_000, rate: 41, nearest: false }]);
  });

  it('income in euros with no exchange of euros at all: rate null, left out of the hryvnia income', async () => {
    await account('uah', 'black', 980, 0);
    await account('eur', 'black', 978, 0);
    for (const a of ['uah', 'eur']) await synced(a);
    await tx('uah', '2026-03-02', 20_000, 'поступления');
    await tx('eur', '2026-03-03', 50_000, 'поступления');
    const v = await svc.monthOverview({ month: '2026-03' });
    expect(v.total.income).toBe(20_000);
    expect(v.total.fx).toEqual([{ currency: 978, income: 50_000, spending: 0, rate: null, nearest: false }]);
  });

  it('cash in euros with a commission: both count at the purchase rate when euros were only ever bought', async () => {
    await account('uah', 'black', 980, 0);
    await account('eur', 'black', 978, 0);
    for (const a of ['uah', 'eur']) await synced(a);
    // €1 000.00 bought with hryvnia at 52.00: the only exchange of euros.
    await tx('uah', '2026-03-02', -5_200_000, 'свои переводы', { rule: 'pair_fx', op: { currency: 978, amount: -100_000 } });
    await tx('eur', '2026-03-02', 100_000, 'свои переводы', { rule: 'pair_fx', op: { currency: 980, amount: 5_200_000 } });
    // Withdrawn €1 000.00 + €9.00 commission (the amount includes it).
    await tx('eur', '2026-03-04', -100_900, 'наличные', { mcc: 6011, commission: 900 });
    const v = await svc.monthOverview({ month: '2026-03' });
    expect(v.total.spending).toBe(100_900 * 52);
    expect(v.total.fx).toEqual([{ currency: 978, income: 0, spending: 100_900, rate: 52, nearest: false }]);
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

  it('family and person: each person\'s card has its own fx at the family\'s rate; account cards stay in their currency', async () => {
    await account('mine', 'black', 980, 0);
    await synced('mine');
    const her = Number((await db.execute(`INSERT INTO participants (label, color, created_at) VALUES ('Вигадана', 'aqua', 0) RETURNING id`)).rows[0]?.id);
    const conn = Number((await db.execute({ sql: `INSERT INTO connections (participant_id, provider, created_at) VALUES (?, 'monobank', 0) RETURNING id`, args: [her] })).rows[0]?.id);
    await insertAccountRow(db, { id: 'herusd', connection_id: conn, kind: 'card', type: 'white', currency_code: 840, balance: 0, updated_at: SYNCED_TO });
    await synced('herusd');
    // My sale of $100.00 at 41.00 sets the rate for everyone.
    await tx('mine', '2026-03-02', 410_000, 'свои переводы', { rule: 'pair_fx', op: { currency: 840, amount: 10_000 } });
    await tx('mine', '2026-03-03', -1_000, 'продукты');
    await tx('herusd', '2026-03-04', -500, 'продукты');

    const family = await svc.monthOverview({ month: '2026-03' });
    expect(family.total).toMatchObject({ spending: 1_000 + 500 * 41, fx: [{ currency: 840, income: 0, spending: 500, rate: 41, nearest: false }] });
    const hersView = family.people.find((p) => p.participantId === her)!;
    expect(hersView.total).toMatchObject({ spending: 500 * 41, fx: [{ currency: 840, income: 0, spending: 500, rate: 41, nearest: false }] });
    expect(family.people.find((p) => p.participantId !== her)!.total).toMatchObject({ spending: 1_000, fx: [] });

    const person = await svc.monthOverview({ month: '2026-03', participantId: her });
    expect(person.total.fx).toEqual([{ currency: 840, income: 0, spending: 500, rate: 41, nearest: false }]);
    expect(person.accounts).toEqual([
      { id: 'herusd', label: 'white/USD', kind: 'card', currency: 840, creditLimit: 0, ownFunds: 0, income: 0, spending: 500 },
    ]);
  });

  it('nothing the renderer gets contains a name, description, card number, IBAN or jar title', async () => {
    await account('uah', 'black', 980, 1_000);
    await account('jar1', null, 980, 1_000);
    await synced('uah');
    await tx('uah', '2026-03-02', -10_000, 'переводы людям');
    const me = Number((await db.execute('SELECT id FROM participants ORDER BY id LIMIT 1')).rows[0]?.id);
    const out = JSON.stringify([
      await svc.spending({ from: '2026-03-01', to: '2026-03-31' }),
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
  it('spending takes participantId; without it — everyone', async () => {
    await account('mine', 'black', 980, 10_000);
    const her = Number((await db.execute(`INSERT INTO participants (label, created_at) VALUES ('Вигадана', 0) RETURNING id`)).rows[0]?.id);
    const conn = Number((await db.execute({ sql: `INSERT INTO connections (participant_id, provider, created_at) VALUES (?, 'monobank', 0) RETURNING id`, args: [her] })).rows[0]?.id);
    await insertAccountRow(db, { id: 'hers', connection_id: conn, kind: 'card', type: 'white', currency_code: 980, balance: 3_000, updated_at: SYNCED_TO });
    await tx('mine', '2026-03-02', -1_000, 'продукты');
    await tx('hers', '2026-03-03', -400, 'продукты');
    for (const a of ['mine', 'hers']) await synced(a);
    const q = { from: '2026-03-01', to: '2026-03-10' };
    const total = async (participantId?: number) =>
      (await svc.spending({ ...q, ...(participantId !== undefined ? { participantId } : {}) })).currencies[0]?.total.net;
    expect(await total()).toBe(1_400);
    expect(await total(her)).toBe(400);
  });
});
