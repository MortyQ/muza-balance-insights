// A-Bank with its real rules in the derivation: a `MONO*` credit pairs with the Monobank debit, the cashback credit is
// income and never a transfer half, a cancellation is a refund (paired when it comes quickly, a refund in its
// category when it comes later). Invented data only.
import { describe, expect, it } from 'vitest';
import { CATEGORY, categorize, type CategorizeInput } from '../../src/derive/categories.ts';
import { detectRefunds, type RefundTx } from '../../src/derive/refunds.ts';
import { detectTransfers, type TransferAccount, type TransferTx } from '../../src/derive/transfers.ts';

const ACCOUNTS: TransferAccount[] = [
  { id: 'mono', kind: 'card', currencyCode: 980, iban: 'UA111', title: null, provider: 'monobank', participantId: 1 },
  { id: 'abank', kind: 'card', currencyCode: 980, iban: 'UA222', title: null, provider: 'abank', participantId: 1 },
];

const row = (id: string, accountId: string, time: number, amount: number, mcc: number | null, description: string): TransferTx => ({
  id, accountId, time, amount, operationAmount: amount, commissionRate: 0, mcc, description, bankCategory: null, counterIban: null,
});

const category = (amount: number, mcc: number | null, description: string): string => {
  const input: CategorizeInput = { description, mcc, amount, bankCategory: null, counterName: null, isInternalTransfer: false, isFamilyTransfer: false, provider: 'abank' };
  return categorize(input);
};

describe('Monobank ↔ A-Bank', () => {
  it('a Monobank debit and the A-Bank `MONO*` credit a minute later: a pair', () => {
    const marks = detectTransfers([row('out', 'mono', 1000, -500_000, 4829, 'Вигадана Особа'), row('in', 'abank', 1060, 500_000, 4829, 'MONO*VYHADANA OSOBA')], ACCOUNTS);
    expect(marks.get('out')).toEqual({ rule: 'pair', pairId: 'in' });
    expect(marks.get('in')).toEqual({ rule: 'pair', pairId: 'out' });
  });

  it('the cashback credit is never a transfer half', () => {
    const marks = detectTransfers([row('out', 'mono', 1000, -3_250, 4829, 'Вигадана Особа'), row('in', 'abank', 1030, 3_250, 4829, 'Зарахування кешбеку на картку')], ACCOUNTS);
    expect(marks.get('in')).toBeUndefined();
  });
});

describe('A-Bank categories', () => {
  it('cashback and an unpaired transfer in are income; a transfer out goes to people; a merchant code its table category', () => {
    expect(category(3_250, 4829, 'Зарахування кешбеку на картку')).toBe(CATEGORY.income);
    expect(category(500_000, 4829, 'MONO*VYHADANA OSOBA')).toBe(CATEGORY.income);
    expect(category(-100_000, 4829, 'Вигадана Особа')).toBe(CATEGORY.p2p);
    expect(category(-125_040, 5411, 'Вигаданий супермаркет')).toBe(CATEGORY.groceries);
  });

  it('a late cancellation keeps its merchant category, so it counts as a refund, not income', () => {
    expect(category(200_000, 5211, 'Скасування. Вигаданий магазин')).toBe(CATEGORY.home);
    expect(category(8_420, null, 'Вигадана аптека, місто')).not.toBe(CATEGORY.income);
  });
});

describe('A-Bank refunds', () => {
  const r = (id: string, time: number, amount: number, mcc: number | null, description: string): RefundTx => ({
    id, accountId: 'abank', time, amount, mcc, description, bankCategory: null, isInternal: false, provider: 'abank',
  });

  it('a cancellation within the window pairs with its purchase; the cashback credit never does', () => {
    const pairs = detectRefunds([r('buy', 1000, -100, 5411, 'Вигаданий магазин'), r('cancel', 1060, 100, 5411, 'Скасування. Вигаданий магазин'), r('cb', 1070, 100, 4829, 'Зарахування кешбеку на картку')]);
    expect(pairs.get('buy')).toBe('cancel');
    expect(pairs.has('cb')).toBe(false);
  });
});
