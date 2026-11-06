// ČSOB's operation types and generic categories, as its English payment history states them. One source for the
// reader (direction, the stored bank category), the category table and the rules. Taken from the masked layout of an
// export (design of change bank-csob).

export const CARD_PAYMENT = 'Debit card transaction';
export const CARD_REFUND = 'Card transaction - refund';
export const CASH_DEPOSIT = 'Cash deposit through cash deposit ATM';
export const FOREIGN_FEE = 'Foreign payment - fee';

/** A standing order names itself with its number: `El. banking standing order (123)`. */
export const STANDING_ORDER = 'El. banking standing order';
const STANDING_ORDER_RE = /^El\. banking standing order \(.*\)$/;

/** A type as the rules know it: a standing order without its number. */
export const typeName = (type: string) => (STANDING_ORDER_RE.test(type.trim()) ? STANDING_ORDER : type.trim());

/** Payments in and out: transfers, unless the bank put them in a category of its own. */
export const INCOMING_TRANSFERS: ReadonlySet<string> = new Set(['Incoming instant payment', 'Incoming payment', 'Incoming foreign payment']);
export const OUTGOING_TRANSFERS: ReadonlySet<string> = new Set([
  'Outgoing instant payment',
  'Outgoing payment',
  'Outgoing payment - Payment button',
  STANDING_ORDER,
]);
export const TRANSFER_TYPES: ReadonlySet<string> = new Set([...INCOMING_TRANSFERS, ...OUTGOING_TRANSFERS]);

/** Types that add money (an unsigned amount is a credit) and those that take it (a debit). */
export const CREDIT_TYPES: ReadonlySet<string> = new Set([...INCOMING_TRANSFERS, CARD_REFUND, CASH_DEPOSIT]);
export const DEBIT_TYPES: ReadonlySet<string> = new Set([...OUTGOING_TRANSFERS, CARD_PAYMENT, FOREIGN_FEE]);

/** Categories that say nothing beyond «money came in / went out»: a transfer type keeps its type instead. */
export const GENERIC_CATEGORIES: ReadonlySet<string> = new Set(['Income', 'Outgoing unclassified', 'Bank transactions', '']);
