import { describe, expect, it } from 'vitest';
import { csobRules } from '../../../src/providers/csob/rules.ts';
import type { RuleTx } from '../../../src/providers/types.ts';

const tx = (bankCategory: string | null, amount: number): RuleTx => ({ description: 'Test Shop', mcc: null, amount, bankCategory });

describe('csobRules', () => {
  it('a transfer type is a transfer: income in, p2p out', () => {
    for (const t of ['Incoming instant payment', 'Incoming payment', 'Incoming foreign payment']) {
      expect(csobRules.isTransferLike(tx(t, 5000))).toBe(true);
      expect(csobRules.categoryHint(tx(t, 5000))).toBe('income');
      expect(csobRules.incomeSource(tx(t, 5000))).toBe('transfer');
      expect(csobRules.isRefundCredit(tx(t, 5000))).toBe(false);
    }
    for (const t of ['Outgoing instant payment', 'Outgoing payment', 'Outgoing payment - Payment button', 'El. banking standing order']) {
      expect(csobRules.isTransferLike(tx(t, -5000))).toBe(true);
      expect(csobRules.categoryHint(tx(t, -5000))).toBe('p2p');
      expect(csobRules.isPersonTransfer(tx(t, -5000), { jarTitles: new Set() })).toBe(true);
    }
  });

  it('a spending category gives its hint and is no transfer', () => {
    expect(csobRules.isTransferLike(tx('TV, internet, phone', -5000))).toBe(false);
    expect(csobRules.categoryHint(tx('TV, internet, phone', -5000))).toBe('telecom');
  });

  it.each([
    ['Groceries', 'groceries'],
    ['Restaurants', 'cafes'],
    ['Income', 'income'],
    ['Taxes', 'taxes'],
    ['Fuel', 'car'],
    ['Car', 'car'],
    ['Drugstore goods', 'beauty'],
    ['Transportation', 'transport'],
    ['Leisure time and entertainment', 'entertainment'],
    ['ATM Withdrawals', 'cash'],
    ['Clothing and shoes', 'clothing'],
    ['Vacation', 'travel'],
    ['Health', 'health'],
    ['Insurance', 'insurance'],
    ['Sports and equipment', 'sport'],
    ['Home equipment', 'home'],
    ['Shopping and services', null],
    ['Outgoing unclassified', null],
    ['Bank transactions', null],
    ['Foreign payment - fee', null],
  ])('category %s → %s', (category, hint) => {
    expect(csobRules.knowsBankCategory(category)).toBe(true);
    expect(csobRules.categoryHint(tx(category, -1000))).toBe(hint);
  });

  it('a cash deposit is income, not a refund', () => {
    const deposit = tx('Cash deposit through cash deposit ATM', 20000);
    expect(csobRules.categoryHint(deposit)).toBe('income');
    expect(csobRules.isRefundCredit(deposit)).toBe(false);
  });

  it('a card refund or a credit in a spending category is a refund credit', () => {
    expect(csobRules.isRefundCredit(tx('Card transaction - refund', 1500))).toBe(true);
    expect(csobRules.isRefundCredit(tx('Groceries', 1500))).toBe(true);
    expect(csobRules.isRefundCredit(tx('Income', 1500))).toBe(false);
    expect(csobRules.isRefundCredit(tx('Groceries', -1500))).toBe(false);
  });

  it('an unknown category is not known and gives no hint', () => {
    expect(csobRules.knowsBankCategory('Pets and animals')).toBe(false);
    expect(csobRules.categoryHint(tx('Pets and animals', -1000))).toBeNull();
    expect(csobRules.categoryHint(tx(null, -1000))).toBeNull();
  });

  it('keeps no text in the analysis copy', () => {
    expect(csobRules.maskDescription('Test Shop', { jarTitles: new Set() })).toEqual({ description: '[other]', descClass: 'other' });
  });
});
