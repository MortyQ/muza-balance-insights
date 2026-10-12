// The data channels narrowed to one bank (provider). The second bank exists only here: two registry entries in core
// (types + rules), mocked — the data service itself knows no bank by name. Fictional fixtures only.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Db } from '@mono/core/db';
import type { ProviderKey, RatesView } from '../src/shared/api.ts';

vi.mock('../../../packages/core/src/providers/types.ts', async (orig) => ({
  ...(await orig<typeof import('../../../packages/core/src/providers/types.ts')>()),
  PROVIDER_IDS: ['monobank', 'testbank'],
}));
vi.mock('../../../packages/core/src/providers/rules.ts', async () => {
  const { monobankRules } = await import('../../../packages/core/src/providers/monobank/rules.ts');
  const PROVIDER_RULES: Record<string, typeof monobankRules> = { monobank: monobankRules, testbank: monobankRules };
  return { PROVIDER_RULES, rulesFor: (p: string) => PROVIDER_RULES[p] };
});

const { kyivStartOfDay } = await import('@mono/core/format');
const { insertAccountRow, memoryDb, testConnection } = await import('@mono/core/test-helpers');
const { DataService } = await import('../src/main/data.ts');

const TESTBANK = 'testbank' as ProviderKey;
const NOW = kyivStartOfDay('2026-03-15') + 12 * 3600;
const SYNCED_TO = kyivStartOfDay('2026-03-14') + 23 * 3600;
const RATES: RatesView = { list: [], fetchedAt: NOW - 3600, saved: false };

let db: Db;
let svc: InstanceType<typeof DataService>;
let me: number;
let her: number;
let seq = 0;

async function card(id: string, connectionId: number, balance: number) {
  await insertAccountRow(db, { id, connection_id: connectionId, kind: 'card', type: 'black', currency_code: 980, balance, updated_at: SYNCED_TO });
  await db.execute({ sql: 'INSERT INTO sync_state VALUES (?, ?, ?, ?)', args: [id, kyivStartOfDay('2026-01-01'), SYNCED_TO, SYNCED_TO + 60] });
}

async function tx(accountId: string, date: string, amount: number, category: string, internal = false) {
  await db.execute({
    sql: `INSERT INTO transactions (id, account_id, time, local_date, description, mcc, hold, amount, operation_amount, currency_code,
            commission_rate, category, is_internal_transfer, transfer_rule, scope, is_cancelled, raw_json, synced_at)
          VALUES (?, ?, ?, ?, 'Вигаданий опис', 5411, 0, ?, ?, 980, 0, ?, ?, ?, 'personal', 0, '{}', 0)`,
    args: [`t${++seq}`, accountId, kyivStartOfDay(date) + 3600, date, amount, amount, category, internal ? 1 : 0, internal ? 'pair' : null],
  });
}

const connection = async (participant: number, provider: string) =>
  Number((await db.execute({ sql: 'INSERT INTO connections (participant_id, provider, created_at) VALUES (?, ?, 0) RETURNING id', args: [participant, provider] })).rows[0]?.id);

// me: Monobank (me-mono) and the test bank (me-test); her: Monobank only (her-mono). March 2026.
beforeEach(async () => {
  seq = 0;
  db = await memoryDb();
  svc = new DataService({ open: async () => db, release: async () => undefined, nowSec: () => NOW, rates: async () => RATES });
  const meMono = await testConnection(db);
  me = Number((await db.execute({ sql: 'SELECT participant_id FROM connections WHERE id = ?', args: [meMono] })).rows[0]?.participant_id);
  her = Number((await db.execute(`INSERT INTO participants (label, color, created_at) VALUES ('Вигадана', 'aqua', 0) RETURNING id`)).rows[0]?.id);
  await card('me-mono', meMono, 100_000);
  await card('me-test', await connection(me, 'testbank'), 40_000);
  await card('her-mono', await connection(her, 'monobank'), 7_000);
  await tx('me-mono', '2026-03-10', -10_000, 'продукты');
  await tx('me-test', '2026-03-10', -5_000, 'продукты');
  await tx('her-mono', '2026-03-10', -3_000, 'продукты');
  await tx('me-test', '2026-03-11', 70_000, 'поступления');
  // The owner's own money moving between the two banks.
  await tx('me-mono', '2026-03-12', -20_000, 'свои переводы', true);
  await tx('me-test', '2026-03-12', 20_000, 'свои переводы', true);
});
afterEach(() => db.close());

describe('the data channels narrowed to one bank', () => {
  it('spending: all banks, one bank, a bank and a person', async () => {
    const net = async (q: object) => (await svc.spendingOverview({ month: '2026-03', scope: 'personal', ...q })).total.net;
    expect(await net({})).toBe(18_000);
    expect(await net({ provider: 'monobank' })).toBe(13_000);
    expect(await net({ provider: TESTBANK })).toBe(5_000);
    expect(await net({ provider: 'monobank', participantId: me })).toBe(10_000);
  });

  it('the family view of one bank: the people add up to the total, each part is «that person, that bank»', async () => {
    const mono = await svc.spendingOverview({ month: '2026-03', scope: 'personal', provider: 'monobank' });
    expect(mono.people.map((p) => [p.participantId, p.net])).toEqual([[me, 10_000], [her, 3_000]]);
    expect(mono.people.reduce((s, p) => s + p.net, 0)).toBe(mono.total.net);
    const test = await svc.spendingOverview({ month: '2026-03', scope: 'personal', provider: TESTBANK });
    expect(test.people.map((p) => [p.participantId, p.net])).toEqual([[me, 5_000], [her, 0]]);
  });

  it('a person view of one bank: the family total is that bank\'s too', async () => {
    const one = await svc.spendingOverview({ month: '2026-03', scope: 'personal', provider: 'monobank', participantId: her });
    expect([one.total.net, one.familyTotal]).toEqual([3_000, 13_000]);
  });

  it('a person without a connection at the bank gets zeros, not an error', async () => {
    const q = { month: '2026-03', provider: TESTBANK, participantId: her };
    expect((await svc.spendingOverview({ ...q, scope: 'personal' })).total.net).toBe(0);
    const month = await svc.monthOverview(q);
    expect([month.total.ownFunds, month.total.accounts, month.total.income, month.total.spending, month.accounts]).toEqual([0, 0, 0, 0, []]);
    expect((await svc.incomeOverview(q)).summary.total).toBe(0);
    expect((await svc.nowOverview({ provider: TESTBANK, participantId: her })).week.total.net).toBe(0);
  });

  it('balances and the month\'s flow: own funds, income and spending of the bank; the own transfer counts nowhere', async () => {
    const total = async (q: object) => {
      const t = (await svc.monthOverview({ month: '2026-03', ...q })).total;
      return [t.ownFunds, t.accounts, t.income, t.spending];
    };
    expect(await total({})).toEqual([147_000, 3, 70_000, 18_000]);
    expect(await total({ provider: 'monobank' })).toEqual([107_000, 2, 0, 13_000]);
    expect(await total({ provider: TESTBANK })).toEqual([40_000, 1, 70_000, 5_000]);
    const people = (await svc.monthOverview({ month: '2026-03', provider: TESTBANK })).people;
    expect(people.map((p) => [p.participantId, p.total.ownFunds])).toEqual([[me, 40_000], [her, 0]]);
    const mine = await svc.monthOverview({ month: '2026-03', provider: TESTBANK, participantId: me });
    expect(mine.accounts.map((a) => a.id)).toEqual(['me-test']);
  });

  it('the category, income, analytics and «Now» answers narrow the same way', async () => {
    const category = async (q: object) => (await svc.categoryOverview({ month: '2026-03', category: 'groceries', scope: 'personal', ...q })).lines.length;
    expect([await category({}), await category({ provider: 'monobank' }), await category({ provider: TESTBANK })]).toEqual([3, 2, 1]);

    const income = async (q: object) => (await svc.incomeOverview({ month: '2026-03', ...q })).summary.total;
    expect([await income({}), await income({ provider: 'monobank' }), await income({ provider: TESTBANK })]).toEqual([70_000, 0, 70_000]);

    const spent = async (q: object) => (await svc.analyticsOverview({ from: '2026-03', to: '2026-03', ...q })).totals.spending;
    expect([await spent({}), await spent({ provider: 'monobank' }), await spent({ provider: TESTBANK })]).toEqual([18_000, 13_000, 5_000]);

    const week = async (q: object) => (await svc.nowOverview(q)).week.total.net;
    expect([await week({}), await week({ provider: 'monobank' }), await week({ provider: TESTBANK })]).toEqual([18_000, 13_000, 5_000]);
  });
});
