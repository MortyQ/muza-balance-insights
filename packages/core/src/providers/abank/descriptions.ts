// A-Bank's service texts, one source for its rules and its masking. Taken from the masked shape of real A-Bank
// statements (design of change core-abank-statements); free text (names, merchants) never appears here.

/** The bank's cashback credit (MCC 4829, yet not a transfer). */
export const CASHBACK_TEXT = 'Зарахування кешбеку на картку';

export const CASH_TEXT = 'Зняття готівки';

/** A cancelled purchase: the prefix, then the merchant. */
export const CANCEL_PREFIX = 'Скасування. ';

/** A transfer from a Monobank card: the prefix, then the sender's name. */
export const MONO_SENDER_RE = /^(MONO\*)(\S.*)$/;

export const isCashback = (description: string) => description.trim() === CASHBACK_TEXT;
