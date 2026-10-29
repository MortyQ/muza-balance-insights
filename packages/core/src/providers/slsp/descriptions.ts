// Slovenská sporiteľňa's operation types, as the first line of a row's description states them in the Slovak
// statement. One source for the reader (stored as the bank category), the category table and the rules. Taken from
// the masked shape of real statements (design of change core-slsp-statements).

export const CARD_PAYMENT = 'Platba kartou';
export const CASH_WITHDRAWAL = 'Výber kartou';
export const CASH_DEPOSIT = 'Vklad cez ATM';
/** A returned purchase. */
export const RETURNED_GOODS = 'Návrat tovaru';

/** Instant and SEPA payments, in and out. */
export const TRANSFER_TYPES: ReadonlySet<string> = new Set([
  'Prijatá Okamžitá platba',
  'Okamžitá platba (elektronicky)',
  'SEPA platba (elektronicky)',
  'Prijatá SEPA platba',
]);
