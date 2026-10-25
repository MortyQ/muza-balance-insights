// PrivatBank's rules: its rows carry no MCC, so transfers are told by the bank's own category, own transfers by its
// service texts, and categories by its category table (categories.ts).
import { OTHER_PLACEHOLDER, type DescClass, type ProviderRules, type RuleTx } from '../types.ts';
import { BANK_CATEGORIES, TRANSFER_CATEGORIES } from './categories.ts';
import { CASH_TEXT, FROM_PREFIX_RE, JAR_TEXT, OWN_CARD_FROM_RE, OWN_CARD_TO_RE, isOwnCardText, isTreasuryDescription } from './descriptions.ts';

const isTransfer = (tx: RuleTx) => tx.bankCategory !== null && TRANSFER_CATEGORIES.has(tx.bankCategory);

const isOwnText = (text: string) => isOwnCardText(text) || text === JAR_TEXT;

export const privatbankRules: ProviderRules = {
  id: 'privatbank',

  isTransferLike: isTransfer,

  isOwnTransferText: (tx) => isTransfer(tx) && isOwnText(tx.description.trim()),

  // The jar is not an account of the app: its text names none.
  ownTransferCounterpart(tx) {
    if (!isTransfer(tx) || !isOwnCardText(tx.description.trim())) return null;
    return { kind: 'card', type: 'card', currencyCode: null };
  },

  isServiceTransferText: (tx) => isTransfer(tx) && isOwnText(tx.description.trim()),

  isAutoTopUp: () => false,

  isRefundCredit: (tx) => tx.amount > 0 && !isTransfer(tx),

  isTreasury: isTreasuryDescription,

  isBusinessAccount: () => false,

  knowsBankCategory: (name) => BANK_CATEGORIES.has(name),

  categoryHint(tx) {
    if (isTransfer(tx)) {
      if (isTreasuryDescription(tx.description)) return 'taxes';
      return tx.amount > 0 ? 'income' : 'p2p';
    }
    return tx.bankCategory === null ? null : (BANK_CATEGORIES.get(tx.bankCategory) ?? null);
  },

  incomeSource(tx) {
    if (FROM_PREFIX_RE.test(tx.description.trim())) return 'named_sender';
    if (isTransfer(tx)) return 'transfer';
    return 'other';
  },

  namedSender(description) {
    const m = FROM_PREFIX_RE.exec(description.trim());
    return m ? { label: 'від', name: m[1]! } : null;
  },

  isPersonTransfer: (tx) => isTransfer(tx) && !isOwnText(tx.description.trim()) && !isTreasuryDescription(tx.description),

  maskDescription(raw) {
    const text = raw.trim();
    if (text === JAR_TEXT || text === CASH_TEXT) return { description: text, descClass: 'service' };
    if (OWN_CARD_TO_RE.test(text) || OWN_CARD_FROM_RE.test(text)) return { description: text.replace(/\d{4}$/, '9999'), descClass: 'service' };
    // Shape-only classes: the text itself is never kept.
    return { description: OTHER_PLACEHOLDER, descClass: classifyShape(text) };
  },
};

function classifyShape(text: string): DescClass {
  if (FROM_PREFIX_RE.test(text)) return 'from_prefix';
  if (isTreasuryDescription(text)) return 'treasury';
  return 'other';
}
