// Monobank's rules: how its operations look (MCC conventions, bank texts, account types). Thresholds and texts come
// from real data (phase 3 reports): own transfers are always MCC 4829 on both sides, 6012 is a financial institution.
import { JAR_PLACEHOLDER, OTHER_PLACEHOLDER, type DescClass, type ProviderRules, type RuleTx } from '../types.ts';
import {
  AUTO_TOPUP_DESCRIPTIONS,
  INSTALLMENT_DESCRIPTION,
  JAR_TEMPLATE,
  OWN_TRANSFER_COUNTERPART,
  SERVICE_EXACT,
  isFromPrefixDescription,
  isTransferServiceDescription,
  isTreasuryDescription,
  jarTemplateTitle,
} from './descriptions.ts';
import { MAX_STATEMENT_WINDOW_SEC, RATE_LIMIT_MS } from './constants.ts';

const TRANSFER_MCC = 4829;
/** Financial institutions: observed as credit-limit charges (debits, 1st of the month) and incoming
 *  transfers from other banks (credits, «Від: …») — opposite flows, so split by sign. */
const FINANCIAL_INSTITUTION_MCC = 6012;

const isTransfer = (tx: RuleTx) => tx.mcc === TRANSFER_MCC;

export const monobankRules: ProviderRules = {
  id: 'monobank',
  api: { bank: 'Monobank', requestIntervalMs: RATE_LIMIT_MS, maxWindowSec: MAX_STATEMENT_WINDOW_SEC },

  isTransferLike: isTransfer,

  isOwnTransferText: (tx, ctx) =>
    isTransfer(tx) && isTransferServiceDescription(tx.description, ctx.jarTitles, { includeGeneric: false }),

  // Auto top-ups (jar side) name no card; «Переказ на картку» is never an own-transfer text.
  ownTransferCounterpart(tx, ctx) {
    if (!isTransfer(tx)) return null;
    const text = tx.description.trim();
    const card = OWN_TRANSFER_COUNTERPART.get(text);
    if (card) return { kind: 'card', ...card };
    const title = jarTemplateTitle(text) ?? (ctx.jarTitles.has(text) ? text : null);
    return title === null ? null : { kind: 'jar', title };
  },

  isServiceTransferText: (tx, ctx) =>
    isTransfer(tx) && isTransferServiceDescription(tx.description, ctx.jarTitles, { includeGeneric: true }),

  isAutoTopUp: (tx) => AUTO_TOPUP_DESCRIPTIONS.has(tx.description.trim()),

  isRefundCredit: (tx) => tx.amount > 0 && isTransfer(tx) && !isFromPrefixDescription(tx.description),

  isTreasury: isTreasuryDescription,

  isBusinessAccount: (account) => account.type === 'fop',

  categoryHint(tx) {
    if (tx.description.trim() === INSTALLMENT_DESCRIPTION) return 'installments';
    if (isTransfer(tx)) {
      if (isTreasuryDescription(tx.description)) return 'taxes';
      return tx.amount > 0 ? 'income' : 'p2p';
    }
    if (tx.mcc === FINANCIAL_INSTITUTION_MCC) return tx.amount > 0 ? 'income' : 'installments';
    return null;
  },

  incomeSource(tx) {
    if (tx.mcc === FINANCIAL_INSTITUTION_MCC) return 'other_bank';
    if (isFromPrefixDescription(tx.description)) return 'named_sender';
    if (isTransfer(tx)) return 'transfer';
    return 'other';
  },

  namedSender(description) {
    const d = description.trim();
    return isFromPrefixDescription(d) ? { label: 'Від:', name: d.slice(d.indexOf(':') + 1) } : null;
  },

  isPersonTransfer: (tx, ctx) =>
    isTransfer(tx) &&
    !isTransferServiceDescription(tx.description, ctx.jarTitles, { includeGeneric: true }) &&
    !isTreasuryDescription(tx.description),

  maskDescription(raw, ctx) {
    const text = raw.trim();
    if (SERVICE_EXACT.has(text)) return { description: text, descClass: 'service' };

    const template = JAR_TEMPLATE.exec(text);
    if (template) return { description: `${template[1]} «${JAR_PLACEHOLDER}»`, descClass: 'service' };

    if (ctx.jarTitles.has(text)) return { description: JAR_PLACEHOLDER, descClass: 'service' };

    // Shape-only classes: the text itself is never kept.
    return { description: OTHER_PLACEHOLDER, descClass: classifyShape(text) };
  },
};

function classifyShape(text: string): DescClass {
  if (/^\d{6}\*+\d{4}$/.test(text)) return 'card_pan';
  if (isFromPrefixDescription(text)) return 'from_prefix';
  if (isTreasuryDescription(text)) return 'treasury';
  return 'other';
}
