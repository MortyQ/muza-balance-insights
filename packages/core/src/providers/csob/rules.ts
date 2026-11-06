// ČSOB's rules: its rows carry no MCC but a bank category. A transfer type is stored in place of a generic category
// (the reader), so those rows are transfers; every other row takes its hint from the category table. Own transfers come
// from the domain's IBAN rule: the reader turns a Czech counter account into its IBAN.
import { OTHER_PLACEHOLDER, type ProviderRules, type RuleTx } from '../types.ts';
import { BANK_CATEGORIES } from './categories.ts';
import { CASH_DEPOSIT, TRANSFER_TYPES } from './descriptions.ts';

const isTransfer = (tx: RuleTx) => tx.bankCategory !== null && TRANSFER_TYPES.has(tx.bankCategory);

export const csobRules: ProviderRules = {
  id: 'csob',

  isTransferLike: isTransfer,

  isOwnTransferText: () => false,

  ownTransferCounterpart: () => null,

  isServiceTransferText: () => false,

  isAutoTopUp: () => false,

  // A credit that is no transfer, income or cash deposit: money back from a merchant.
  isRefundCredit: (tx) => tx.amount > 0 && !isTransfer(tx) && tx.bankCategory !== CASH_DEPOSIT && tx.bankCategory !== 'Income',

  isTreasury: () => false,

  isBusinessAccount: () => false,

  knowsBankCategory: (name) => BANK_CATEGORIES.has(name),

  categoryHint(tx) {
    if (isTransfer(tx)) return tx.amount > 0 ? 'income' : 'p2p';
    return tx.bankCategory === null ? null : (BANK_CATEGORIES.get(tx.bankCategory) ?? null);
  },

  incomeSource: (tx) => (isTransfer(tx) ? 'transfer' : 'other'),

  namedSender: () => null,

  isPersonTransfer: isTransfer,

  // A merchant or a person's name: the text itself is never kept.
  maskDescription: () => ({ description: OTHER_PLACEHOLDER, descClass: 'other' }),
};
