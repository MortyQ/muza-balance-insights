// Transfers between banks (transfers.ts, the cross-bank pass): a debit in one provider's account and a credit in
// another's, one currency, the credit at most CROSS_BANK_WINDOW_SEC later, the debit larger by at most
// CROSS_BANK_FEE_PERCENT of the credit. A second, fictional bank joins the registries by mocks only and borrows
// Monobank's rules (a transfer is MCC 4829). Invented data only.
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Db } from '../../src/storage/db.ts';
import type { ProviderId } from '../../src/providers/types.ts';
import { addConnection, addParticipant } from '../../src/people/participants.ts';
import { toKyivDate } from '../../src/shared/format.ts';
import {
  CROSS_BANK_WINDOW_SEC,
  TRANSFER_WINDOW_SEC,
  detectTransfers,
  markInternalTransfers,
  type TransferAccount,
  type TransferMark,
  type TransferTx,
} from '../../src/derive/transfers.ts';
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
const ACCOUNTS: TransferAccount[] = [
  { id: 'mono', kind: 'card', currencyCode: 980, iban: 'UA111', title: null, provider: 'monobank', participantId: 1 },
  { id: 'mono2', kind: 'card', currencyCode: 980, iban: 'UA112', title: null, provider: 'monobank', participantId: 1 },
  { id: 'monoUsd', kind: 'card', currencyCode: 840, iban: 'UA113', title: null, provider: 'monobank', participantId: 1 },
  { id: 'fic', kind: 'card', currencyCode: 980, iban: 'UA222', title: null, provider: FICTIONAL, participantId: 1 },
  { id: 'fic2', kind: 'card', currencyCode: 980, iban: 'UA223', title: null, provider: FICTIONAL, participantId: 1 },
  { id: 'ficUsd', kind: 'card', currencyCode: 840, iban: 'UA224', title: null, provider: FICTIONAL, participantId: 1 },
  { id: 'ficOther', kind: 'card', currencyCode: 980, iban: 'UA333', title: null, provider: FICTIONAL, participantId: 2 },
];

function tx(id: string, accountId: string, time: number, amount: number, extra: Partial<TransferTx> = {}): TransferTx {
  return { id, accountId, time, amount, operationAmount: amount, commissionRate: 0, mcc: 4829, description: '', bankCategory: null, counterIban: null, ...extra };
}

function marksOf(rows: TransferTx[], accounts = ACCOUNTS): Record<string, TransferMark | undefined> {
  const m = detectTransfers(rows, accounts);
  return Object.fromEntries(rows.map((r) => [r.id, m.get(r.id)]));
}

describe('detectTransfers: between banks', () => {
  it('an own transfer, the credit 2 minutes later: a pair, no fee', () => {
    expect(marksOf([tx('out', 'mono', 1000, -50_000), tx('in', 'fic', 1120, 50_000)])).toEqual({
      out: { rule: 'pair', pairId: 'in' },
      in: { rule: 'pair', pairId: 'out' },
    });
  });

  it('too far apart (4 minutes), the credit first, or not a transfer: no pair', () => {
    expect(marksOf([tx('out', 'mono', 1000, -50_000), tx('in', 'fic', 1240, 50_000)])).toEqual({ out: undefined, in: undefined });
    expect(marksOf([tx('out', 'mono', 1000, -50_000), tx('in', 'fic', 1000 + CROSS_BANK_WINDOW_SEC, 50_000)]).out).toEqual({ rule: 'pair', pairId: 'in' });
    // A credit a minute before the debit (an exact mirror within 20 s is the same-bank `pair` rule, any banks).
    expect(marksOf([tx('in', 'fic', 940, 50_000), tx('out', 'mono', 1000, -50_000)])).toEqual({ in: undefined, out: undefined });
    expect(marksOf([tx('out', 'mono', 1000, -50_000, { mcc: 5411 }), tx('in', 'fic', 1060, 50_000)])).toEqual({ out: undefined, in: undefined });
  });

  it('the same second: the credit may sort before the debit', () => {
    expect(marksOf([tx('a-in', 'fic', 1000, 50_000), tx('b-out', 'mono', 1000, -50_000)])['b-out']).toEqual({ rule: 'pair', pairId: 'a-in' });
  });

  it('different currencies, or one bank: not this rule', () => {
    expect(marksOf([tx('out', 'monoUsd', 1000, -5_000), tx('in', 'fic', 1060, 5_000)])).toEqual({ out: undefined, in: undefined });
    expect(marksOf([tx('out', 'mono', 1000, -5_000), tx('in', 'ficUsd', 1060, 5_000)])).toEqual({ out: undefined, in: undefined });
    // Two Monobank cards 1 minute apart, or with a difference: the same-bank rules only (20 s, exact).
    expect(marksOf([tx('out', 'mono', 1000, -50_000), tx('in', 'mono2', 1060, 50_000)])).toEqual({ out: undefined, in: undefined });
    expect(marksOf([tx('out', 'mono', 1000, -51_000), tx('in', 'mono2', 1005, 50_000)])).toEqual({ out: undefined, in: undefined });
  });

  it('the tolerance: 3% is a pair with its implicit fee, 5% still, 6% not', () => {
    expect(marksOf([tx('out', 'mono', 1000, -10_300), tx('in', 'fic', 1060, 10_000)])).toEqual({
      out: { rule: 'pair_fee', pairId: 'in', fee: 300 },
      in: { rule: 'pair_fee', pairId: 'out' },
    });
    expect(marksOf([tx('out', 'mono', 1000, -10_500), tx('in', 'fic', 1060, 10_000)]).out).toEqual({ rule: 'pair_fee', pairId: 'in', fee: 500 });
    expect(marksOf([tx('out', 'mono', 1000, -10_600), tx('in', 'fic', 1060, 10_000)])).toEqual({ out: undefined, in: undefined });
    // A credit larger than the debit is no transfer fee.
    expect(marksOf([tx('out', 'mono', 1000, -10_000), tx('in', 'fic', 1060, 10_100)])).toEqual({ out: undefined, in: undefined });
  });

  it('a stated commission is not the implicit fee: only the rest of the difference is', () => {
    expect(marksOf([tx('out', 'mono', 1000, -10_300, { commissionRate: 300 }), tx('in', 'fic', 1060, 10_000)]).out).toEqual({ rule: 'pair_fee', pairId: 'in' });
    expect(marksOf([tx('out', 'mono', 1000, -10_300, { commissionRate: 100 }), tx('in', 'fic', 1060, 10_000)]).out).toEqual({ rule: 'pair_fee', pairId: 'in', fee: 200 });
  });

  it('the closest candidate wins, then the smallest difference, each row in one pair', () => {
    expect(marksOf([tx('out', 'mono', 1000, -10_000), tx('late', 'fic', 1120, 10_000), tx('near', 'fic2', 1030, 10_000)])).toEqual({
      out: { rule: 'pair', pairId: 'near' },
      near: { rule: 'pair', pairId: 'out' },
      late: undefined,
    });
    expect(marksOf([tx('out', 'mono', 1000, -10_300), tx('fee3', 'fic', 1060, 10_000), tx('fee1', 'fic2', 1060, 10_200)]).out).toEqual({ rule: 'pair_fee', pairId: 'fee1', fee: 100 });
  });

  it('between two people: a family transfer, its implicit fee kept', () => {
    expect(marksOf([tx('out', 'mono', 1000, -10_200), tx('in', 'ficOther', 1060, 10_000)])).toEqual({
      out: { rule: 'family', pairId: 'in', fee: 200 },
      in: { rule: 'family', pairId: 'out' },
    });
  });

  it('a same-bank pair keeps its row: the cross-bank rule takes only what is left', () => {
    expect(marksOf([tx('out', 'mono', 1000, -10_000), tx('in', 'mono2', 1005, 10_000), tx('fin', 'fic', 1010, 10_000)])).toEqual({
      out: { rule: 'pair', pairId: 'in' },
      in: { rule: 'pair', pairId: 'out' },
      fin: undefined,
    });
  });
});

describe('markInternalTransfers: between banks', () => {
  let db: Db;
  afterEach(() => db?.close());

  async function seed(): Promise<void> {
    db = await memoryDb();
    const me = await addParticipant(db, { label: 'Fictional Person' }, 0);
    const mono = await addConnection(db, me, 'monobank', 0, 'file');
    const fic = await addConnection(db, me, FICTIONAL, 0, 'file');
    await insertAccountRow(db, { id: 'mono', connection_id: mono, kind: 'card', currency_code: 980, balance: 0, updated_at: 0 });
    await insertAccountRow(db, { id: 'fictional:card', connection_id: fic, kind: 'card', currency_code: 980, balance: 0, updated_at: 0 });
  }

  async function row(id: string, accountId: string, time: number, amount: number): Promise<void> {
    await insertTransactionRow(db, {
      id, account_id: accountId, time, local_date: toKyivDate(time), description: '', mcc: 4829, hold: 0, amount,
      operation_amount: amount, currency_code: 980, commission_rate: 0, category: 'другое', synced_at: 0,
    });
  }

  const marks = async () =>
    (await db.execute('SELECT id, is_internal_transfer, transfer_rule, transfer_pair_id, transfer_fee FROM transactions ORDER BY id')).rows.map((r) => ({ ...r }));

  it('a window that holds only the debit finds the credit 150 s later; losing the pair clears the fee', async () => {
    await seed();
    const T = 1_780_000_000;
    await row('out', 'mono', T, -10_300);
    await row('in', 'fictional:card', T + 150, 10_000);
    expect(150).toBeGreaterThan(2 * TRANSFER_WINDOW_SEC);

    expect(await markInternalTransfers(db, { from: T - 10, to: T })).toEqual({ from: T, to: T + 150 });
    expect(await marks()).toEqual([
      { id: 'in', is_internal_transfer: 1, transfer_rule: 'pair_fee', transfer_pair_id: 'out', transfer_fee: null },
      { id: 'out', is_internal_transfer: 1, transfer_rule: 'pair_fee', transfer_pair_id: 'in', transfer_fee: 300 },
    ]);

    // Only the fee changes (the credit's final amount): it is written, the pair stays.
    await db.execute(`UPDATE transactions SET amount = 10100, operation_amount = 10100 WHERE id = 'in'`);
    await markInternalTransfers(db, { from: T + 150, to: T + 150 });
    expect((await marks()).find((r) => r.id === 'out')).toMatchObject({ transfer_rule: 'pair_fee', transfer_pair_id: 'in', transfer_fee: 200 });

    await db.execute(`UPDATE transactions SET is_cancelled = 1 WHERE id = 'in'`);
    await markInternalTransfers(db, { from: T + 150, to: T + 150 });
    expect(await marks()).toEqual([
      { id: 'in', is_internal_transfer: 0, transfer_rule: null, transfer_pair_id: null, transfer_fee: null },
      { id: 'out', is_internal_transfer: 0, transfer_rule: null, transfer_pair_id: null, transfer_fee: null },
    ]);
  });

  it('with one provider the context stays TRANSFER_WINDOW_SEC wide', async () => {
    await seed();
    await db.execute(`DELETE FROM accounts WHERE id = 'fictional:card'`);
    const T = 1_780_000_000;
    await row('far', 'mono', T + 100, -500);
    expect(await markInternalTransfers(db, { from: T - 10, to: T })).toBeNull();
  });
});
