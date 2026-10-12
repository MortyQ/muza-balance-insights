// The provider filter: aggregates and balances narrowed to one bank, alone or with a participant. The second bank
// exists only here, as two registry entries (types + rules) — which is all a new bank adds for the filter to work.
// Fictional data only.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Db } from '../src/db.ts';
import type { ProviderId } from '../src/providers/types.ts';
import { insertAccountRow, memoryDb, testConnection } from './helpers.ts';

vi.mock('../src/providers/types.ts', async (orig) => ({
  ...(await orig<typeof import('../src/providers/types.ts')>()),
  PROVIDER_IDS: ['monobank', 'testbank'],
}));
vi.mock('../src/providers/rules.ts', async () => {
  const { monobankRules } = await import('../src/providers/monobank/rules.ts');
  const PROVIDER_RULES: Record<string, typeof monobankRules> = { monobank: monobankRules, testbank: monobankRules };
  return { PROVIDER_RULES, rulesFor: (p: string) => PROVIDER_RULES[p] };
});

const { rederiveCore } = await import('../src/rederive.ts');
const { incomeSummary, spendingSummary } = await import('../src/summaries.ts');
const { incomeLines } = await import('../src/income-lines.ts');
const { categoryLines } = await import('../src/category-lines.ts');
const { balancesAt, getBalances } = await import('../src/status.ts');

const TESTBANK = 'testbank' as ProviderId;

describe('the provider filter', () => {
  let db: Db;
  let me: number;
  let her: number;
  const q = { from: '2026-02-01', to: '2026-02-28' };
  const NOW = Date.UTC(2026, 2, 15) / 1000;
  const T = Date.UTC(2026, 1, 10, 12) / 1000;

  const insertTx = (id: string, accountId: string, time: number, amount: number, mcc: number, description: string) =>
    db.execute({
      sql: `INSERT INTO transactions (id, account_id, time, local_date, description, mcc, hold, amount, currency_code, raw_json, synced_at)
            VALUES (?, ?, ?, '2026-02-10', ?, ?, 0, ?, 980, '{}', 0)`,
      args: [id, accountId, time, description, mcc, amount],
    });
  const connection = async (participant: number, provider: string) =>
    Number(
      (await db.execute({ sql: 'INSERT INTO connections (participant_id, provider, created_at) VALUES (?, ?, 0) RETURNING id', args: [participant, provider] }))
        .rows[0]?.id,
    );
  const card = (id: string, connectionId: number, iban: string) =>
    insertAccountRow(db, { id, connection_id: connectionId, kind: 'card', type: 'black', currency_code: 980, iban, balance: 0, updated_at: 0 });
  const net = (s: Awaited<ReturnType<typeof spendingSummary>>) => Object.fromEntries(s.groups.map((g) => [g.key, g.net]));
  const income = async (f: object) => (await incomeSummary(db, { ...q, ...f }, NOW)).totals.map((t) => t.total);

  beforeEach(async () => {
    db = await memoryDb();
    const meMono = await testConnection(db);
    me = Number((await db.execute({ sql: 'SELECT participant_id FROM connections WHERE id = ?', args: [meMono] })).rows[0]?.participant_id);
    her = Number((await db.execute(`INSERT INTO participants (label, created_at) VALUES ('Вигадана особа', 0) RETURNING id`)).rows[0]?.id);
    await card('me-mono', meMono, 'UA00ME1');
    await card('me-test', await connection(me, 'testbank'), 'UA00ME2');
    await card('her-mono', await connection(her, 'monobank'), 'UA00HER');
    await insertTx('g1', 'me-mono', T, -10_000, 5411, 'Вигаданий Магазин');
    await insertTx('g2', 'me-test', T + 60, -5_000, 5411, 'Вигаданий Магазин');
    await insertTx('g3', 'her-mono', T + 120, -3_000, 5411, 'Вигаданий Магазин');
    // The owner moves their own money from one bank to the other.
    await insertTx('t-out', 'me-mono', T + 600, -20_000, 4829, 'Вигаданий переказ');
    await insertTx('t-in', 'me-test', T + 602, 20_000, 4829, 'Вигаданий переказ');
    await insertTx('s1', 'me-test', T + 900, 70_000, 4829, 'Від: Вигаданий Роботодавець');
    await rederiveCore(db);
  });
  afterEach(() => db.close());

  it('the fixture: the move between the two banks is an own transfer', async () => {
    const rs = await db.execute(`SELECT id, is_internal_transfer FROM transactions WHERE id IN ('t-out', 't-in') ORDER BY id`);
    expect(rs.rows.map((r) => Number(r.is_internal_transfer))).toEqual([1, 1]);
  });

  it('no provider: every bank', async () => {
    expect(net(await spendingSummary(db, q, NOW))).toEqual({ продукты: 18_000 });
  });

  it('one provider narrows the accounts', async () => {
    expect(net(await spendingSummary(db, { ...q, provider: 'monobank' }, NOW))).toEqual({ продукты: 13_000 });
    expect(net(await spendingSummary(db, { ...q, provider: TESTBANK }, NOW))).toEqual({ продукты: 5_000 });
  });

  it('provider and participant combine; a person without that bank gets nothing, not an error', async () => {
    expect(net(await spendingSummary(db, { ...q, provider: 'monobank', participantId: me }, NOW))).toEqual({ продукты: 10_000 });
    expect(net(await spendingSummary(db, { ...q, provider: TESTBANK, participantId: her }, NOW))).toEqual({});
  });

  it('an own transfer between two banks is not spending or income in any view', async () => {
    for (const f of [{}, { provider: 'monobank' as ProviderId }, { provider: TESTBANK }]) {
      expect(Object.keys(net(await spendingSummary(db, { ...q, ...f }, NOW)))).toEqual(['продукты']);
      expect((await incomeLines(db, { ...q, ...f }, NOW)).lines.map((l) => l.id)).not.toContain('t-in');
    }
  });

  it('income and the line lists narrow the same way', async () => {
    expect(await income({})).toEqual([70_000]);
    expect(await income({ provider: TESTBANK })).toEqual([70_000]);
    expect(await income({ provider: 'monobank' })).toEqual([]);
    expect((await incomeLines(db, { ...q, provider: 'monobank' }, NOW)).lines).toEqual([]);
    expect((await categoryLines(db, { ...q, category: 'продукты', provider: TESTBANK }, NOW)).lines.map((l) => l.id)).toEqual(['g2']);
  });

  it('balances narrow the same way', async () => {
    const ids = (b: { accounts: ReadonlyArray<{ id: string }> }) => b.accounts.map((a) => a.id).sort();
    expect(ids(await getBalances(db))).toEqual(['her-mono', 'me-mono', 'me-test']);
    expect(ids(await getBalances(db, { provider: TESTBANK }))).toEqual(['me-test']);
    expect(ids(await balancesAt(db, { endSec: NOW, provider: 'monobank', participantId: her }))).toEqual(['her-mono']);
    expect(ids(await balancesAt(db, { endSec: NOW, provider: TESTBANK, participantId: her }))).toEqual([]);
  });

  it('an unknown provider is refused', async () => {
    await expect(spendingSummary(db, { ...q, provider: 'nobank' as ProviderId }, NOW)).rejects.toThrow();
  });
});
