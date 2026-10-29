// Slovenská sporiteľňa states no category: its operation type is stored as the bank category instead. null = a type
// the rules decide (transfers, refunds) or the merchant keywords decide (card payments, merchants.ts).
import type { CategoryHint } from '../types.ts';
import { CARD_PAYMENT, CASH_DEPOSIT, CASH_WITHDRAWAL, RETURNED_GOODS, TRANSFER_TYPES } from './descriptions.ts';

export const BANK_CATEGORIES: ReadonlyMap<string, CategoryHint | null> = new Map<string, CategoryHint | null>([
  ...[...TRANSFER_TYPES].map((t): [string, null] => [t, null]),
  [CARD_PAYMENT, null],
  [RETURNED_GOODS, null],
  [CASH_WITHDRAWAL, 'cash'],
  // The user's own cash paid in: no «cash in» category exists, and leaving it out would break the balance view.
  [CASH_DEPOSIT, 'income'],
]);
