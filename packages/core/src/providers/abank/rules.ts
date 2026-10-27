// A-Bank's rules: its rows carry the MCC the bank states, and the MCC decides, as for Monobank — 4829 a transfer, 6012
// a financial institution, every other code the common table. The cashback credit carries 4829 but is income.
import { OTHER_PLACEHOLDER, type DescClass, type ProviderRules, type RuleTx } from '../types.ts';
import { BANK_CATEGORIES } from './categories.ts';
import { CANCEL_PREFIX, CASH_TEXT, CASHBACK_TEXT, MONO_SENDER_RE, isCashback } from './descriptions.ts';

const TRANSFER_MCC = 4829;
/** Financial institutions: a credit is money from another bank. */
const FINANCIAL_INSTITUTION_MCC = 6012;

const isTransfer = (tx: RuleTx) => tx.mcc === TRANSFER_MCC && !isCashback(tx.description);

export const abankRules: ProviderRules = {
  id: 'abank',

  isTransferLike: isTransfer,

  // No own-transfer text is known for A-Bank yet.
  isOwnTransferText: () => false,

  ownTransferCounterpart: () => null,

  isServiceTransferText: () => false,

  isAutoTopUp: () => false,

  isRefundCredit: (tx) => tx.amount > 0 && !isTransfer(tx) && !isCashback(tx.description) && tx.mcc !== FINANCIAL_INSTITUTION_MCC,

  isTreasury: () => false,

  isBusinessAccount: () => false,

  knowsBankCategory: (name) => BANK_CATEGORIES.has(name),

  categoryHint(tx) {
    if (isCashback(tx.description)) return 'income';
    if (isTransfer(tx)) return tx.amount > 0 ? 'income' : 'p2p';
    if (tx.mcc === FINANCIAL_INSTITUTION_MCC && tx.amount > 0) return 'income';
    return null;
  },

  incomeSource(tx) {
    if (tx.mcc === FINANCIAL_INSTITUTION_MCC) return 'other_bank';
    if (MONO_SENDER_RE.test(tx.description.trim())) return 'named_sender';
    if (isTransfer(tx)) return 'transfer';
    return 'other';
  },

  namedSender(description) {
    const m = MONO_SENDER_RE.exec(description.trim());
    return m ? { label: m[1]!, name: m[2]! } : null;
  },

  isPersonTransfer: isTransfer,

  maskDescription(raw) {
    const text = raw.trim();
    if (text === CASHBACK_TEXT || text === CASH_TEXT) return { description: text, descClass: 'service' };
    if (text.startsWith(CANCEL_PREFIX)) return { description: `${CANCEL_PREFIX}${OTHER_PLACEHOLDER}`, descClass: 'service' };
    const sender = MONO_SENDER_RE.exec(text);
    if (sender) return { description: `${sender[1]}${OTHER_PLACEHOLDER}`, descClass: 'from_prefix' };
    // Shape-only class: the text itself is never kept.
    return { description: OTHER_PLACEHOLDER, descClass: 'other' satisfies DescClass };
  },
};
