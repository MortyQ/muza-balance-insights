// Transfers between banks in the figures (spending.ts): an implicit fee (transfer_fee) is a «комиссии за переводы»
// line in every view, a stated commission stays «комиссии банка», the body is excluded as for any internal or (whole
// family) family transfer, and a pair with a disabled account counts whole. spendingSummary, spendingGrid and
// categoryLines read the same lines. A second, fictional bank joins the registries by mocks only and borrows
// Monobank's rules. Invented data only.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Db } from '../../src/storage/db.ts';
import type { ProviderId } from '../../src/providers/types.ts';
import { CATEGORY } from '../../src/derive/categories.ts';
import { rederiveCore } from '../../src/derive/rederive.ts';
import { addConnection, addParticipant } from '../../src/people/participants.ts';
import { kyivStartOfDay, toKyivDate } from '../../src/shared/format.ts';
import { categoryLines } from '../../src/read/category-lines.ts';
import { incomeSummary } from '../../src/read/income.ts';
import { spendingGrid, spendingSummary } from '../../src/read/spending.ts';
import { insertAccountRow, insertTransactionRow, memoryDb } from '../helpers.ts';

vi.mock('../../src/providers/types.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/providers/types.ts')>()),
  PROVIDER_IDS: ['monobank', 'fictional'],
}));
vi.mock('../../src/providers/rules.ts', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../src/providers/rules.ts')>();
  return { ...real, rulesFor: (p: string) => real.rulesFor(p === 'fictional' ? 'monobank' : (p as ProviderId)) };
});

const FICTIONAL = 'fictional' as ProviderId;
const T = kyivStartOfDay('2026-03-10') + 12 * 3600;
const PERIOD = { from: '2026-03-01', to: '2026-03-31' };
const NOW = kyivStartOfDay('2026-04-02');

let db: Db;
let me: number;
let other: number;

async function row(id: string, accountId: string, time: number, amount: number, o: { mcc?: number; commission?: number } = {}): Promise<void> {
  await insertTransactionRow(db, {
    id, account_id: accountId, time, local_date: toKyivDate(time), description: '', mcc: o.mcc ?? 4829, hold: 0, amount,
    operation_amount: amount, currency_code: 980, commission_rate: o.commission ?? 0, category: 'другое', synced_at: 0,
  });
}

beforeEach(async () => {
  db = await memoryDb();
  me = await addParticipant(db, { label: 'Fictional Person' }, 0);
  other = await addParticipant(db, { label: 'Another Fictional Person' }, 0);
  const mono = await addConnection(db, me, 'monobank', 0, 'file');
  const fic = await addConnection(db, me, FICTIONAL, 0, 'file');
  const ficOther = await addConnection(db, other, FICTIONAL, 0, 'file');
  for (const [id, connection] of [['mono', mono], ['fictional:mine', fic], ['fictional:theirs', ficOther]] as const) {
    await insertAccountRow(db, { id, connection_id: connection, kind: 'card', currency_code: 980, balance: 0, updated_at: 0 });
  }
  await row('buy', 'mono', T, -5_000, { mcc: 5411 });
  // Own, an implicit fee of 300.
  await row('own-out', 'mono', T + 100, -10_300);
  await row('own-in', 'fictional:mine', T + 160, 10_000);
  // Own, the whole difference a stated commission.
  await row('fee-out', 'mono', T + 1_000, -10_300, { commission: 300 });
  await row('fee-in', 'fictional:mine', T + 1_090, 10_000);
  // To the other person, an implicit fee of 400.
  await row('fam-out', 'mono', T + 2_000, -20_400);
  await row('fam-in', 'fictional:theirs', T + 2_120, 20_000);
  await rederiveCore(db);
});
afterEach(() => db.close());

const byCategory = async (participantId?: number) =>
  Object.fromEntries(
    (await spendingSummary(db, { ...PERIOD, ...(participantId === undefined ? {} : { participantId }) }, NOW)).groups.map((g) => [g.key, g.net]),
  );

describe('cross-bank transfers in the figures', () => {
  it('the stored marks: the debit carries its implicit fee', async () => {
    const rs = await db.execute(`SELECT id, transfer_rule, transfer_fee FROM transactions WHERE id LIKE '%-out' ORDER BY id`);
    expect(rs.rows.map((r) => ({ ...r }))).toEqual([
      { id: 'fam-out', transfer_rule: 'family', transfer_fee: 400 },
      { id: 'fee-out', transfer_rule: 'pair_fee', transfer_fee: null },
      { id: 'own-out', transfer_rule: 'pair_fee', transfer_fee: 300 },
    ]);
  });

  it('the whole family: the bodies are out, the implicit fees are transfer fees, the stated commission a bank fee', async () => {
    expect(await byCategory()).toEqual({ [CATEGORY.groceries]: 5_000, [CATEGORY.transferFees]: 700, [CATEGORY.fees]: 300 });
  });

  it('one person: the family transfer is spending «to family» without its fee; the receiver has it as income', async () => {
    expect(await byCategory(me)).toEqual({ [CATEGORY.groceries]: 5_000, [CATEGORY.family]: 20_000, [CATEGORY.transferFees]: 700, [CATEGORY.fees]: 300 });
    expect(await byCategory(other)).toEqual({});
    const income = await incomeSummary(db, { ...PERIOD, participantId: other }, NOW);
    expect(income.totals).toMatchObject([{ currency: 980, total: 20_000 }]);
    expect((await incomeSummary(db, { ...PERIOD, participantId: me }, NOW)).totals).toEqual([]);
  });

  it('a pair with a disabled account counts whole, with no transfer fee line', async () => {
    await db.execute(`UPDATE accounts SET sync_choice = 0 WHERE id = 'fictional:mine'`);
    await rederiveCore(db);
    const s = await spendingSummary(db, PERIOD, NOW);
    expect(Object.fromEntries(s.groups.map((g) => [g.key, g.net]))[CATEGORY.transferFees]).toBe(400);
    // 5 000 + 10 300 + 10 300 (bodies and the commission) + 400 (the family fee).
    expect(s.totals).toMatchObject([{ currency: 980, net: 26_000 }]);
  });

  it('spendingGrid and categoryLines read the same lines', async () => {
    for (const participantId of [undefined, me]) {
      const q = { ...PERIOD, ...(participantId === undefined ? {} : { participantId }) };
      const grid = await spendingGrid(db, { ...q, unit: 'month' }, NOW);
      const fromGrid: Record<string, number> = {};
      for (const c of grid.cells) fromGrid[c.category] = (fromGrid[c.category] ?? 0) + c.net;
      expect(fromGrid).toEqual(await byCategory(participantId));
    }
    const lines = await categoryLines(db, { ...PERIOD, category: CATEGORY.transferFees }, NOW);
    expect(lines.lines.map((l) => [l.id, l.kind, l.amount, l.operationAmount])).toEqual([
      ['fam-out', 'transfer_fee', -400, null],
      ['own-out', 'transfer_fee', -300, null],
    ]);
    const family = await categoryLines(db, { ...PERIOD, category: CATEGORY.family, participantId: me }, NOW);
    expect(family.lines.map((l) => [l.id, l.kind, l.amount, l.operationAmount])).toEqual([['fam-out', 'body', -20_000, -20_000]]);
  });
});
