// Transfers between participants (transfer_rule family): not internal; «семье» for the sender, income (source
// family) for the receiver when one person is viewed; excluded when the whole family is viewed. Fictional data only.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Db } from '../src/db.ts';
import { rederiveCore } from '../src/rederive.ts';
import { incomeSummary, spendingSummary } from '../src/summaries.ts';
import { detectTransfers, type TransferAccount, type TransferTx } from '../src/transfers.ts';
import { insertAccountRow, memoryDb, testConnection } from './helpers.ts';

describe('detectTransfers: family (pure)', () => {
  const accounts: TransferAccount[] = [
    { id: 'my-black', kind: 'card', currencyCode: 980, iban: 'UA00ME1', title: null, provider: 'monobank', participantId: 1 },
    { id: 'my-white', kind: 'card', currencyCode: 980, iban: 'UA00ME2', title: null, provider: 'monobank', participantId: 1 },
    { id: 'her-black', kind: 'card', currencyCode: 980, iban: 'UA00HER', title: null, provider: 'monobank', participantId: 2 },
  ];
  const tx = (id: string, accountId: string, time: number, amount: number, counterIban: string | null = null): TransferTx => ({
    id, accountId, time, amount, operationAmount: null, commissionRate: 0, mcc: 4829, description: 'Вигаданий переказ', counterIban,
  });

  it('a mirror pair between two participants is family; between one participant\'s cards it stays pair', () => {
    const m = detectTransfers(
      [tx('out', 'my-black', 100, -1000), tx('in', 'her-black', 102, 1000), tx('o2', 'my-black', 500, -700), tx('i2', 'my-white', 501, 700)],
      accounts,
    );
    expect(m.get('out')).toEqual({ rule: 'family', pairId: 'in' });
    expect(m.get('in')).toEqual({ rule: 'family', pairId: 'out' });
    expect(m.get('o2')).toEqual({ rule: 'pair', pairId: 'i2' });
  });

  it("a single row to another participant's IBAN is family; to one's own IBAN it stays iban", () => {
    const m = detectTransfers([tx('to-her', 'my-black', 100, -500, 'UA00HER'), tx('to-me', 'my-black', 900, -300, 'UA00ME2')], accounts);
    expect(m.get('to-her')).toEqual({ rule: 'family', pairId: null });
    expect(m.get('to-me')).toEqual({ rule: 'iban', pairId: null });
  });
});

describe('family in the database and the aggregates', () => {
  let db: Db;
  let me: number;
  let her: number;
  const q = { from: '2026-02-01', to: '2026-02-28' };
  const NOW = Date.UTC(2026, 2, 15) / 1000;

  const insertTx = (id: string, accountId: string, time: number, amount: number, mcc: number, description: string) =>
    db.execute({
      sql: `INSERT INTO transactions (id, account_id, time, local_date, description, mcc, hold, amount, currency_code, raw_json, synced_at)
            VALUES (?, ?, ?, '2026-02-10', ?, ?, 0, ?, 980, '{}', 0)`,
      args: [id, accountId, time, description, mcc, amount],
    });
  const row = async (id: string) =>
    (await db.execute({ sql: 'SELECT category, is_internal_transfer, transfer_rule, refund_pair_id FROM transactions WHERE id = ?', args: [id] })).rows[0];
  const net = (s: Awaited<ReturnType<typeof spendingSummary>>) => Object.fromEntries(s.groups.map((g) => [g.key, g.net]));

  beforeEach(async () => {
    db = await memoryDb();
    const meConn = await testConnection(db);
    me = Number((await db.execute({ sql: 'SELECT participant_id FROM connections WHERE id = ?', args: [meConn] })).rows[0]?.participant_id);
    her = Number((await db.execute(`INSERT INTO participants (label, created_at) VALUES ('Вигадана особа', 0) RETURNING id`)).rows[0]?.id);
    const herConn = Number(
      (await db.execute({ sql: `INSERT INTO connections (participant_id, provider, created_at) VALUES (?, 'monobank', 0) RETURNING id`, args: [her] })).rows[0]?.id,
    );
    await insertAccountRow(db, { id: 'my-black', connection_id: meConn, kind: 'card', type: 'black', currency_code: 980, iban: 'UA00ME1', balance: 0, updated_at: 0 });
    await insertAccountRow(db, { id: 'her-black', connection_id: herConn, kind: 'card', type: 'black', currency_code: 980, iban: 'UA00HER', balance: 0, updated_at: 0 });
    const T = Date.UTC(2026, 1, 10, 12) / 1000;
    await insertTx('out', 'my-black', T, -100_000, 4829, 'Вигадана Особа');
    await insertTx('in', 'her-black', T + 3, 100_000, 4829, 'Від: Вигаданий Я');
    await insertTx('my-food', 'my-black', T + 600, -50_000, 5411, 'Вигаданий Магазин');
    await insertTx('her-food', 'her-black', T + 700, -30_000, 5411, 'Вигаданий Магазин');
    await rederiveCore(db);
  });
  afterEach(() => db.close());

  it('the pair is family, not internal: «семье» for the sender, «поступления» for the receiver, never a refund', async () => {
    expect(await row('out')).toEqual({ category: 'семье', is_internal_transfer: 0, transfer_rule: 'family', refund_pair_id: null });
    expect(await row('in')).toEqual({ category: 'поступления', is_internal_transfer: 0, transfer_rule: 'family', refund_pair_id: null });
  });

  it('the whole family: the transfer is neither spending nor income; one person: it is', async () => {
    expect(net(await spendingSummary(db, q, NOW))).toEqual({ продукты: 80_000 });
    expect(net(await spendingSummary(db, { ...q, participantId: me }, NOW))).toEqual({ семье: 100_000, продукты: 50_000 });
    expect(net(await spendingSummary(db, { ...q, participantId: her }, NOW))).toEqual({ продукты: 30_000 });

    expect((await incomeSummary(db, q, NOW)).groups).toEqual([]);
    expect((await incomeSummary(db, { ...q, participantId: her }, NOW)).groups.map((g) => [g.key, g.total])).toEqual([['family', 100_000]]);
    expect((await incomeSummary(db, { ...q, participantId: me }, NOW)).groups).toEqual([]);
  });
});
