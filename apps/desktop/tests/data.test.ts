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

async function tx(accountId: string, date: string, amount: number, category: string, o: { scope?: string; commission?: number; balance?: number } = {}) {
  await db.execute({
    sql: `INSERT INTO transactions (id, account_id, time, local_date, description, counter_name, mcc, hold, amount, operation_amount,
            currency_code, commission_rate, balance, category, is_internal_transfer, scope, is_cancelled, raw_json, synced_at)
          VALUES (?, ?, ?, ?, ?, ?, 5411, 0, ?, ?, (SELECT currency_code FROM accounts WHERE id = ?), ?, ?, ?, 0, ?, 0, '{}', 0)`,
    args: [
      `t${++seq}`, accountId, kyivStartOfDay(date) + 3600, date, CANARIES[1]!, CANARIES[0]!, amount, amount, accountId,
      o.commission ?? 0, o.balance ?? null, category, o.scope ?? 'personal',
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
    expect(v.total).toEqual({ ownFunds: 100_000, others: [{ currency: 840, ownFunds: 5_000 }], missing: 0, accounts: 2, income: 20_000, spending: 30_000 });
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
    expect(v.total).toEqual({ ownFunds: 0, others: [], missing: 1, accounts: 1, income: 0, spending: 0 });
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
