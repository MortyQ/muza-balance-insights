// The payee a line belongs to, shared by the data process (the category screen's «Where», Insights' payees) and the
// renderer (the list filtered by a payee), so both group the same way.

/**
 * The bank's text of a cancelled purchase: «Скасування. <merchant>». A cancellation is a refund from that merchant, so
 * it belongs to the merchant's payee (seen in Monobank and A-Bank statements).
 */
const CANCEL_PREFIX = /^скасування\.\s*/u;

/** Payees match regardless of case and spaces; a cancellation goes to the merchant it cancels. */
export const payeeKey = (s: string): string => s.toLocaleLowerCase('uk').replace(/\s+/g, ' ').trim().replace(CANCEL_PREFIX, '');
