// ČSOB's own categories (the `category` column of its English payment history) → the common ones. null = known, no
// hint: a generic category, or a transfer type stored in its place, which the rules decide (income or p2p by sign).
// A bank category not here gets no hint and is reported by the re-derivation as unknown.
import type { CategoryHint } from '../types.ts';
import { CARD_PAYMENT, CARD_REFUND, CASH_DEPOSIT, FOREIGN_FEE, TRANSFER_TYPES } from './descriptions.ts';

export const BANK_CATEGORIES: ReadonlyMap<string, CategoryHint | null> = new Map<string, CategoryHint | null>([
  ...[...TRANSFER_TYPES].map((t): [string, null] => [t, null]),
  ['Groceries', 'groceries'],
  ['Restaurants', 'cafes'],
  ['Income', 'income'],
  ['Taxes', 'taxes'],
  ['Fuel', 'car'],
  ['Car', 'car'],
  ['Drugstore goods', 'beauty'],
  ['Transportation', 'transport'],
  ['Leisure time and entertainment', 'entertainment'],
  ['TV, internet, phone', 'telecom'],
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
  // A type stored when the row has no category: the rules decide (refunds), or nothing is known.
  [CARD_PAYMENT, null],
  [CARD_REFUND, null],
  [FOREIGN_FEE, null],
  // The user's own cash paid in (a deposit with no category of its own): no «cash in» category exists.
  [CASH_DEPOSIT, 'income'],
]);
