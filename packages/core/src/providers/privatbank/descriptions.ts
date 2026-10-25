// PrivatBank's service texts, one source for its rules and its masking. Taken from the masked shape of a real Privat24
// statement (design of change core-privatbank-statements); free text (names, merchants) never appears here.

/** To / from the owner's own PrivatBank card, with the other card's last 4 digits. */
export const OWN_CARD_TO_RE = /^На свою картку \*\d{4}$/;
export const OWN_CARD_FROM_RE = /^Зі своєї картки \*\d{4}$/;

/** The savings jar («Скарбничка»): money between a card and it. */
export const JAR_TEXT = 'Скарбничка';

export const CASH_TEXT = 'Зняття готівки в банкоматі';

/** A named incoming transfer: «від <sender>». */
export const FROM_PREFIX_RE = /^від\s+(\S.*)$/;

const TREASURY_RE = /КАЗНАЧЕЙСЬК|УДКСУ/;

export const isOwnCardText = (text: string) => OWN_CARD_TO_RE.test(text) || OWN_CARD_FROM_RE.test(text);

export const isTreasuryDescription = (description: string) => TREASURY_RE.test(description);
