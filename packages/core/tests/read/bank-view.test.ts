// A bank view (spec core-bank-view): the statistics restricted to some banks' accounts. Every other rule stays, so an
// own transfer to a bank outside the view is still a transfer, a family transfer follows the person, the implicit fee
// goes with the debit, and the views of disjoint banks add up to the whole. Monobank, A-Bank and PrivatBank are the
// real registry; the people, accounts and amounts are invented.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Db } from '../../src/storage/db.ts';
import type { ProviderId } from '../../src/providers/types.ts';
import { CATEGORY } from '../../src/derive/categories.ts';
import { rederiveCore } from '../../src/derive/rederive.ts';
import { addConnection, addParticipant } from '../../src/people/participants.ts';
import { kyivStartOfDay, toKyivDate } from '../../src/shared/format.ts';
import { categoryLines } from '../../src/read/category-lines.ts';
import { incomeLines } from '../../src/read/income-lines.ts';
import { incomeSummary } from '../../src/read/income.ts';
import { findRecurring } from '../../src/read/recurring.ts';
import { spendingSummary } from '../../src/read/spending.ts';
import { balancesAt, getBalances } from '../../src/read/status.ts';
import { insertAccountRow, insertTransactionRow, memoryDb } from '../helpers.ts';

const T = kyivStartOfDay('2026-03-10') + 12 * 3600;
const PERIOD = { from: '2026-03-01', to: '2026-03-31' };
const NOW = kyivStartOfDay('2026-04-02');
const BANKS: ProviderId[] = ['monobank', 'abank', 'privatbank'];

let db: Db;
let me: number;
let other: number;

async function row(
  id: string,
  accountId: string,
  time: number,
  amount: number,
  o: { mcc?: number; description?: string } = {},
): Promise<void> {
  await insertTransactionRow(db, {
    id, account_id: accountId, time, local_date: toKyivDate(time), description: o.description ?? '', mcc: o.mcc ?? 4829,
    hold: 0, amount, operation_amount: amount, currency_code: 980, commission_rate: 0, category: 'другое', synced_at: 0,
  });
}

beforeEach(async () => {
  db = await memoryDb();
  me = await addParticipant(db, { label: 'Fictional Person' }, 0);
  other = await addParticipant(db, { label: 'Another Fictional Person' }, 0);
  const accounts = [
    ['mono', me, 'monobank', 1_000],
    ['abank:mine', me, 'abank', 2_000],
    ['abank:theirs', other, 'abank', 4_000],
    ['privatbank:mine', me, 'privatbank', 8_000],
  ] as const;
  for (const [id, participant, provider, balance] of accounts) {
    const connection = await addConnection(db, participant, provider, 0, 'file');
    await insertAccountRow(db, { id, connection_id: connection, kind: 'card', currency_code: 980, balance, updated_at: NOW });
  }
  await row('buy-mono', 'mono', T, -5_000, { mcc: 5411 });
  await row('buy-abank', 'abank:mine', T, -3_000, { mcc: 5411 });
  await row('buy-privat', 'privatbank:mine', T, -2_000, { mcc: 5411 });
  // Own, Monobank → A-Bank, an implicit fee of 300.
  await row('own-out', 'mono', T + 100, -10_300);
  await row('own-in', 'abank:mine', T + 160, 10_000);
  // To the other person, Monobank → their A-Bank card, an implicit fee of 400.
  await row('fam-out', 'mono', T + 2_000, -20_400);
  await row('fam-in', 'abank:theirs', T + 2_120, 20_000);
  // Income from outside, one per bank that has some.
  await row('pay-mono', 'mono', T + 50_000, 8_000);
  await row('pay-abank', 'abank:mine', T + 60_000, 6_000);
  await rederiveCore(db);
});
afterEach(() => db.close());

type View = { participantId?: number; providers?: ProviderId[] };

const spending = async (v: View = {}) =>
  Object.fromEntries((await spendingSummary(db, { ...PERIOD, ...v }, NOW)).groups.map((g) => [g.key, g.net]));
const income = async (v: View = {}) => (await incomeSummary(db, { ...PERIOD, ...v }, NOW)).totals.map((t) => [t.currency, t.total]);

function added(views: ReadonlyArray<Record<string, number>>): Record<string, number> {
  const sum: Record<string, number> = {};
  for (const v of views) for (const [k, n] of Object.entries(v)) sum[k] = (sum[k] ?? 0) + n;
  return sum;
}

describe('a bank view', () => {
  it('the stored marks the views rely on', async () => {
    const rs = await db.execute(`SELECT id, transfer_rule, transfer_fee FROM transactions WHERE id IN ('own-out', 'fam-out') ORDER BY id`);
    expect(rs.rows.map((r) => ({ ...r }))).toEqual([
      { id: 'fam-out', transfer_rule: 'family', transfer_fee: 400 },
      { id: 'own-out', transfer_rule: 'pair_fee', transfer_fee: 300 },
    ]);
  });

  it('one bank of three counts only its accounts', async () => {
    expect(await spending({ providers: ['privatbank'] })).toEqual({ [CATEGORY.groceries]: 2_000 });
    expect(await income({ providers: ['privatbank'] })).toEqual([]);
  });

  it('no list: the figures of every bank, as before', async () => {
    expect(await spending()).toEqual({ [CATEGORY.groceries]: 10_000, [CATEGORY.transferFees]: 700 });
    expect(await spending({ providers: BANKS })).toEqual(await spending());
    expect(await income()).toEqual([[980, 14_000]]);
  });

  it('bank and person together', async () => {
    expect(await spending({ participantId: me, providers: ['monobank'] })).toEqual({
      [CATEGORY.groceries]: 5_000,
      [CATEGORY.family]: 20_000,
      [CATEGORY.transferFees]: 700,
    });
    expect(await spending({ participantId: other, providers: ['monobank'] })).toEqual({});
    expect(await income({ participantId: other, providers: ['abank'] })).toEqual([[980, 20_000]]);
  });

  it('an invalid list is refused', async () => {
    for (const providers of [[], ['monobank', 'monobank'], ['nobank']]) {
      await expect(spendingSummary(db, { ...PERIOD, providers: providers as ProviderId[] }, NOW)).rejects.toThrow(/providers/);
      await expect(getBalances(db, { providers: providers as ProviderId[] })).rejects.toThrow(/providers/);
    }
  });

  it('an own transfer stays a transfer when the other bank is hidden', async () => {
    // Monobank alone: the debit is no spending, only its fee; A-Bank alone: the credit is no income.
    expect(await spending({ providers: ['monobank'] })).toEqual({ [CATEGORY.groceries]: 5_000, [CATEGORY.transferFees]: 700 });
    expect(await income({ providers: ['abank'] })).toEqual([[980, 6_000]]);
  });

  it('a family transfer to another bank follows the person', async () => {
    const whole = await spending({ providers: ['monobank'] });
    expect(whole[CATEGORY.family]).toBeUndefined();
    expect((await spending({ participantId: me, providers: ['monobank'] }))[CATEGORY.family]).toBe(20_000);
  });

  it('the implicit fee goes with the bank the money left', async () => {
    expect((await spending({ providers: ['abank'] }))[CATEGORY.transferFees]).toBeUndefined();
    expect((await spending({ providers: ['monobank'] }))[CATEGORY.transferFees]).toBe(700);
  });

  it('the single-bank views add up to the whole, spending and income', async () => {
    for (const v of [{}, { participantId: me }, { participantId: other }]) {
      const views = await Promise.all(BANKS.map((p) => spending({ ...v, providers: [p] })));
      expect(added(views)).toEqual(await spending(v));
      const incomes = await Promise.all(BANKS.map(async (p) => Object.fromEntries(await income({ ...v, providers: [p] }))));
      expect(added(incomes)).toEqual(Object.fromEntries(await income(v)));
    }
  });

  it('balances: one bank, its labels unchanged, bank and person together', async () => {
    const all = await getBalances(db);
    const abank = await getBalances(db, { providers: ['abank'] });
    expect(abank.accounts.map((a) => a.id)).toEqual(['abank:mine', 'abank:theirs']);
    expect(abank.accounts.map((a) => a.label)).toEqual(all.accounts.filter((a) => a.id.startsWith('abank:')).map((a) => a.label));
    expect(abank.totals).toEqual([{ currency: 980, own_funds: 6_000 }]);
    const mine = await balancesAt(db, { endSec: NOW + 1, participantId: me, providers: ['abank', 'privatbank'] });
    expect(mine.accounts.map((a) => a.id)).toEqual(['abank:mine', 'privatbank:mine']);
    expect(mine.totals).toEqual([{ currency: 980, own_funds: 10_000 }]);
  });

  it('category lines and income lines follow the banks', async () => {
    const groceries = await categoryLines(db, { ...PERIOD, category: CATEGORY.groceries, providers: ['abank', 'privatbank'] }, NOW);
    expect(groceries.lines.map((l) => l.id).sort()).toEqual(['buy-abank', 'buy-privat']);
    const lines = await incomeLines(db, { ...PERIOD, providers: ['monobank'] }, NOW);
    expect(lines.lines.map((l) => l.id)).toEqual(['pay-mono']);
  });

  it('regular payments follow the banks', async () => {
    for (const [i, month] of ['2026-01-12', '2026-02-12', '2026-03-12'].entries()) {
      await row(`bill-${i}`, 'privatbank:mine', kyivStartOfDay(month) + 3_600, -1_500, { mcc: 4900, description: 'Fictional Utility' });
    }
    await rederiveCore(db);
    const q = { from: '2026-01-01', to: '2026-03-31' };
    const series = async (providers: ProviderId[]) => (await findRecurring(db, { ...q, providers }, NOW)).length;
    expect(await series(['privatbank'])).toBe(1);
    expect(await series(['monobank', 'abank'])).toBe(0);
  });
});
