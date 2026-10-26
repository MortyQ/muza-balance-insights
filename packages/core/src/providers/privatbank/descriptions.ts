// PrivatBank's service texts, one source for its rules and its masking. Taken from the masked shape of a real Privat24
// statement (design of change core-privatbank-statements); free text (names, merchants) never appears here.

// Each text in the statement's two languages, Ukrainian and English.

/** To / from the owner's own PrivatBank card, with the other card's last 4 digits. */
export const OWN_CARD_RES: readonly RegExp[] = [/^На свою картку \*\d{4}$/, /^Зі своєї картки \*\d{4}$/, /^To my card \*\d{4}$/, /^From my card \*\d{4}$/];

/** The savings jar («Скарбничка», «Moneybox»): money between a card and it. */
export const JAR_TEXTS: ReadonlySet<string> = new Set(['Скарбничка', 'Moneybox']);

export const CASH_TEXTS: ReadonlySet<string> = new Set(['Зняття готівки в банкоматі', 'ATM cash withdrawal']);

/** A named incoming transfer: «від <sender>», «from <sender>»; the label, then the sender. */
export const FROM_PREFIX_RE = /^(від|from)\s+(\S.*)$/;

const TREASURY_RE = /КАЗНАЧЕЙСЬК|УДКСУ/;

export const isOwnCardText = (text: string) => OWN_CARD_RES.some((re) => re.test(text));

export const isTreasuryDescription = (description: string) => TREASURY_RE.test(description);
