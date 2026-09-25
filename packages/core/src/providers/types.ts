// The contract between the domain (transfers, refunds, categories, scope, summaries, search, masking) and a bank
// provider. The domain decides — pairs, categories, scope, what counts as spending — only through these questions;
// everything a provider knows about its own bank (MCC conventions, description texts, account types) stays inside
// providers/<id>/. Types and plain constants only: this file imports nothing.

export const PROVIDER_IDS = ['monobank'] as const;
export type ProviderId = (typeof PROVIDER_IDS)[number];

/** A stored row as the rules see it (columns of `transactions`). */
export interface RuleTx {
  description: string;
  mcc: number;
  amount: number;
}

/** Per-database context some rules need: titles of the jars (a description equal to one is a jar operation). */
export interface RuleContext {
  jarTitles: ReadonlySet<string>;
}

/** Categories a provider may suggest from the shape of an operation; the domain maps them to its names. */
export type CategoryHint = 'installments' | 'taxes' | 'income' | 'p2p';

/**
 * Where income came from, by the shape of the operation (never by name):
 * other_bank = incoming transfer from another bank, named_sender = a named sender (people and FOP clients alike),
 * transfer = other incoming transfers, other = anything else in «поступления».
 */
export type IncomeSource = 'other_bank' | 'named_sender' | 'transfer' | 'other';

export const JAR_PLACEHOLDER = '[jar]';
export const OTHER_PLACEHOLDER = '[other]';

/** Shape of a raw description, kept in the analysis copy instead of the text. */
export type DescClass = 'service' | 'card_pan' | 'from_prefix' | 'treasury' | 'other';

export type MaskedDescription = { description: string; descClass: DescClass };

export interface ProviderRules {
  id: ProviderId;
  /** A money transfer (either side), as opposed to a purchase: the only rows transfer pairs are made of. */
  isTransferLike(tx: RuleTx): boolean;
  /** A bank-generated text of a transfer between the owner's own accounts (the single-row `text` rule). */
  isOwnTransferText(tx: RuleTx, ctx: RuleContext): boolean;
  /** Like isOwnTransferText, plus generic transfer texts that may also be used for other people (diagnostics only). */
  isServiceTransferText(tx: RuleTx, ctx: RuleContext): boolean;
  /** A jar-side automatic top-up (both halves of a `jar_reversal`). */
  isAutoTopUp(tx: RuleTx): boolean;
  /** A credit that may be a refund of an earlier purchase in the same account. */
  isRefundCredit(tx: RuleTx): boolean;
  /** A payment to the state treasury (taxes; business scope by default). */
  isTreasury(description: string): boolean;
  /** Accounts of the owner's business (FOP): business scope. `type` as stored in accounts.type. */
  isBusinessAccount(account: { type: string | null }): boolean;
  /** Category from the shape of the operation, before the MCC table; null = no opinion. */
  categoryHint(tx: RuleTx): CategoryHint | null;
  incomeSource(tx: RuleTx): IncomeSource;
  /** A named incoming transfer split into the bank's label and the sender's name («Від: Name» → «Від:», «Name»), or null. */
  namedSender(description: string): { label: string; name: string } | null;
  /** A transfer whose description is a person's name (not a bank template, not the treasury). */
  isPersonTransfer(tx: RuleTx, ctx: RuleContext): boolean;
  /** Description for the analysis copy: bank templates verbatim, anything else replaced. */
  maskDescription(raw: string, ctx: RuleContext): MaskedDescription;
}
