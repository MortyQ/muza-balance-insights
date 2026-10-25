// Transfers between Monobank and PrivatBank, with PrivatBank's real rules (transfer-like by its bank category, no
// MCC): a withheld fee on the PrivatBank credit is the pair's implicit fee, once; a fee on top of a PrivatBank debit is
// that row's commission, so the pair adds none. Invented data only.
import { describe, expect, it } from 'vitest';
import { detectTransfers, type TransferAccount, type TransferTx } from '../../src/derive/transfers.ts';

const ACCOUNTS: TransferAccount[] = [
  { id: 'mono', kind: 'card', currencyCode: 980, iban: 'UA111', title: null, provider: 'monobank', participantId: 1 },
  { id: 'privat', kind: 'card', currencyCode: 980, iban: null, title: null, provider: 'privatbank', participantId: 1 },
];

const mono = (id: string, time: number, amount: number): TransferTx => ({
  id, accountId: 'mono', time, amount, operationAmount: amount, commissionRate: 0, mcc: 4829, description: '', bankCategory: null, counterIban: null,
});
const privat = (id: string, time: number, amount: number, operationAmount: number, commissionRate: number, bankCategory: string): TransferTx => ({
  id, accountId: 'privat', time, amount, operationAmount, commissionRate, mcc: null, description: 'Вигадана Особа', bankCategory, counterIban: null,
});

describe('Monobank ↔ PrivatBank', () => {
  it('Monobank → PrivatBank, 0.5% withheld from the credit: a pair whose implicit fee is the difference', () => {
    const marks = detectTransfers([mono('out', 1000, -100_000), privat('in', 1060, 99_500, 100_000, 0, 'Зарахування переказу')], ACCOUNTS);
    expect(marks.get('out')).toEqual({ rule: 'pair_fee', pairId: 'in', fee: 500 });
    expect(marks.get('in')).toMatchObject({ rule: 'pair_fee', pairId: 'out' });
  });

  it('PrivatBank → Monobank with a fee on top: a pair; the fee is the debit row\'s own commission', () => {
    const marks = detectTransfers([privat('out', 1000, -10_500, -10_000, 500, 'Перекази'), mono('in', 1030, 10_000)], ACCOUNTS);
    expect(marks.get('out')).toMatchObject({ pairId: 'in' });
    expect(marks.get('in')).toMatchObject({ pairId: 'out' });
  });

  it('a PrivatBank purchase is never a transfer half', () => {
    const marks = detectTransfers([privat('out', 1000, -10_000, 10_000, 0, 'Супермаркети та продукти'), mono('in', 1030, 10_000)], ACCOUNTS);
    expect(marks.get('out')).toBeUndefined();
  });
});
