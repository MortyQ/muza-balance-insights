// Slovenská sporiteľňa's rules: its rows carry no MCC and no category, so the operation type (stored as the bank
// category) tells transfers, cash and refunds, and the merchant keywords (merchants.ts) categorise card payments. Own
// transfers come from the domain's IBAN rule: the statement names the counterparty's IBAN, never an own-transfer text.
import { OTHER_PLACEHOLDER, type ProviderRules, type RuleTx } from '../types.ts';
import { BANK_CATEGORIES } from './categories.ts';
import { CASH_DEPOSIT, TRANSFER_TYPES } from './descriptions.ts';
import { merchantHint } from './merchants.ts';

const isTransfer = (tx: RuleTx) => tx.bankCategory !== null && TRANSFER_TYPES.has(tx.bankCategory);

export const slspRules: ProviderRules = {
  id: 'slsp',

  isTransferLike: isTransfer,

  isOwnTransferText: () => false,

  ownTransferCounterpart: () => null,

  isServiceTransferText: () => false,

  isAutoTopUp: () => false,

  isRefundCredit: (tx) => tx.amount > 0 && !isTransfer(tx) && tx.bankCategory !== CASH_DEPOSIT,

  isTreasury: () => false,

  isBusinessAccount: () => false,

  knowsBankCategory: (name) => BANK_CATEGORIES.has(name),

  categoryHint(tx) {
    if (isTransfer(tx)) return tx.amount > 0 ? 'income' : 'p2p';
    const byType = tx.bankCategory === null ? null : (BANK_CATEGORIES.get(tx.bankCategory) ?? null);
    return byType ?? merchantHint(tx.description);
  },

  incomeSource: (tx) => (isTransfer(tx) ? 'transfer' : 'other'),

  namedSender: () => null,

  isPersonTransfer: isTransfer,

  // A merchant or a person's name: the text itself is never kept.
  maskDescription: () => ({ description: OTHER_PLACEHOLDER, descClass: 'other' }),
};
