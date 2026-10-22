// The contract between the domain (transfers, refunds, categories, scope, summaries, search, masking) and a bank
// provider. The domain decides — pairs, categories, scope, what counts as spending — only through these questions;
// everything a provider knows about its own bank (MCC conventions, description texts, account types) stays inside
// providers/<id>/. Types and plain constants only: this file imports nothing.
//
// A provider has two independent halves: rules (providers/<id>/rules.ts, pure — what the derivation passes use) and
// a client (providers/<id>/client.ts — network, pages, limits; only the import uses it). Re-deriving never loads a
// client.

export const PROVIDER_IDS = ['monobank'] as const;
export type ProviderId = (typeof PROVIDER_IDS)[number];

/** A stored row as the rules see it (columns of `transactions`). */
export interface RuleTx {
  description: string;
  /** null = the bank sends no merchant category code: unknown, never 0. */
  mcc: number | null;
  amount: number;
  /** The bank's own category of the row, as the bank states it; null = none. */
  bankCategory: string | null;
}

/** Per-database context some rules need: titles of the jars (a description equal to one is a jar operation). */
export interface RuleContext {
  jarTitles: ReadonlySet<string>;
}

/**
 * The other side of a single-row own transfer, as its text names it: a jar by title, or a card / account by the
 * provider's type (and currency, when the text says it; null = any).
 */
export type OwnTransferCounterpart = { kind: 'jar'; title: string } | { kind: 'card'; type: string; currencyCode: number | null };

/**
 * The domain categories a provider may suggest — from the shape of an operation, or from the bank's own category of
 * it; the domain maps each to its name (derive/categories.ts). Not here: bank fees, own and family transfers, which
 * only the derivation sets.
 */
export const CATEGORY_HINTS = [
  'groceries', 'cafes', 'transport', 'health', 'beauty', 'clothing', 'home', 'telecom', 'entertainment', 'travel', 'sport',
  'pets', 'insurance', 'taxes', 'cash', 'delivery', 'education', 'gifts', 'utilities', 'marketplaces', 'charity', 'p2p',
  'installments', 'income', 'other',
] as const;
export type CategoryHint = (typeof CATEGORY_HINTS)[number];

/**
 * Where income came from, by the shape of the operation (never by name):
 * other_bank = incoming transfer from another bank, named_sender = a named sender (people and FOP clients alike),
 * transfer = other incoming transfers, other = anything else in «поступления».
 */
export type ProviderIncomeSource = 'other_bank' | 'named_sender' | 'transfer' | 'other';

export const JAR_PLACEHOLDER = '[jar]';
export const OTHER_PLACEHOLDER = '[other]';

/** Shape of a raw description, kept in the analysis copy instead of the text. */
export type DescClass = 'service' | 'card_pan' | 'from_prefix' | 'treasury' | 'other';

export type MaskedDescription = { description: string; descClass: DescClass };

/** Facts about the bank's API the domain plans around (no network code). */
export interface ProviderApiInfo {
  /** Where the client sends its requests (`https://host`); the desktop allowlist must hold this host. */
  origin: string;
  /** Minimum time between two requests with one credential. */
  requestIntervalMs: number;
  /** Longest statement window one request may ask for. */
  maxWindowSec: number;
}

/** Access with a credential through the bank's API. */
export interface ProviderTokenAccess {
  /** A credential-shaped string (the whole string); nothing else is kept. */
  credential: RegExp;
  api: ProviderApiInfo;
}

/**
 * What the app knows about a bank before any of its code runs: its name, how it can be connected, how its ids are
 * stored, its card types. Pure data (providers/<id>/info.ts), listed in providers/info.ts — the only list of banks.
 */
export interface ProviderInfo {
  id: ProviderId;
  /** The brand name, not translated. */
  name: string;
  /** null token = no API: the bank is connected by statement files only. */
  access: { token: ProviderTokenAccess | null; file: boolean };
  /** 'bare' — the bank's ids are stored as they are (Monobank only, by history); 'prefixed' — as `<id>:<bank id>`. */
  ids: 'bare' | 'prefixed';
  /** The bank's card types (accounts.type), for names on screens and a new card from a file. */
  cardTypes: ReadonlyArray<string>;
  /** The type a new card from a file gets unless the user picks another; null = none. */
  defaultCardType: string | null;
}

export interface ProviderRules {
  id: ProviderId;
  /** A money transfer (either side), as opposed to a purchase: the only rows transfer pairs are made of. */
  isTransferLike(tx: RuleTx): boolean;
  /** A bank-generated text of a transfer between the owner's own accounts (the single-row `text` rule). */
  isOwnTransferText(tx: RuleTx, ctx: RuleContext): boolean;
  /** What an own-transfer text says about the other side; null = it names none (e.g. a jar's auto top-up). */
  ownTransferCounterpart(tx: RuleTx, ctx: RuleContext): OwnTransferCounterpart | null;
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
  /** Category from the shape of the operation or the bank's category, before the MCC table; null = no opinion. */
  categoryHint(tx: RuleTx): CategoryHint | null;
  incomeSource(tx: RuleTx): ProviderIncomeSource;
  /** A named incoming transfer split into the bank's label and the sender's name («Від: Name» → «Від:», «Name»), or null. */
  namedSender(description: string): { label: string; name: string } | null;
  /** A transfer whose description is a person's name (not a bank template, not the treasury). */
  isPersonTransfer(tx: RuleTx, ctx: RuleContext): boolean;
  /** Description for the analysis copy: bank templates verbatim, anything else replaced. */
  maskDescription(raw: string, ctx: RuleContext): MaskedDescription;
}

// ---------- the client half (import) ----------

/** An account as the domain stores it (columns of `accounts`). */
export interface NormalizedAccount {
  id: string;
  kind: 'card' | 'jar';
  /** The provider's own account type (Monobank: black/white/fop …); NULL for jars. */
  type: string | null;
  currencyCode: number;
  iban: string | null;
  maskedPan: ReadonlyArray<string> | null;
  title: string | null;
  goal: number | null;
  balance: number;
  creditLimit: number | null;
}

/**
 * An operation as the domain stores it (columns of `transactions`). Optional fields are absent when the bank does not
 * send them — stored as NULL, never guessed. `raw` = the bank's original item as JSON (re-processing without re-import).
 */
export interface NormalizedTx {
  id: string;
  time: number;
  amount: number;
  currencyCode: number;
  hold: boolean;
  /** Absent = the bank sends no merchant category code. */
  mcc?: number;
  /** The bank's own category, as the bank states it (its rules map it). */
  bankCategory?: string;
  description?: string;
  originalMcc?: number;
  operationAmount?: number;
  commissionRate?: number;
  cashbackAmount?: number;
  balance?: number;
  comment?: string;
  receiptId?: string;
  counterEdrpou?: string;
  counterIban?: string;
  counterName?: string;
  raw: string;
}

/** The account holder's accounts, and the bank's id of the holder (to catch a credential of another person). */
export interface ProviderAccounts {
  externalClientId: string | null;
  /** The holder's name as the bank states it (personal data: stored as the participant's label only); null = not sent. */
  holderName: string | null;
  accounts: NormalizedAccount[];
}

/** What the sync loop needs from a bank. Rate limits, pages and retries inside one request are the client's. */
export interface ProviderClient {
  provider: ProviderId;
  accounts(): Promise<ProviderAccounts>;
  /** Every operation of one window [from, to] (unix seconds), all pages; nothing is written. */
  statementWindow(
    accountId: string,
    window: { from: number; to: number },
    onPage?: (page: number, received: number) => void,
  ): Promise<NormalizedTx[]>;
}

// ---------- the statement file half (upload) ----------

/** What a statement file turned out to be. */
export type StatementKind = 'card';

/**
 * A statement file as the core reads it: never bytes. The caller turns the file into one of these (text decoded from
 * UTF-8; a workbook into sheets; a PDF into positioned text items) — the core holds no archive or PDF code.
 */
export type StatementDocument =
  | { format: 'text'; text: string }
  | { format: 'sheets'; sheets: Array<{ name: string; rows: Cell[][] }> }
  | {
      format: 'pdf';
      pages: Array<{ width: number; height: number; items: Array<{ x: number; y: number; w: number; h: number; text: string }> }>;
    };

/** A spreadsheet cell: its stored value as text (numbers never as floats), typed string, number or boolean; null = empty. */
export type Cell = { t: 's' | 'n' | 'b'; v: string } | null;

/** What identifies a statement's account in the file, as far as the file states it. */
export interface StatementAccount {
  iban: string | null;
  /** Masked card numbers of the account. */
  cards: string[];
  /** The provider's card type, when the file states it. */
  type: string | null;
}

/** One account of a statement file: its currency and its rows, oldest first, without ids (the importer sets them). */
export interface ParsedStatement {
  kind: StatementKind;
  /** The account currency (ISO 4217 numeric), from the file. */
  currencyCode: number;
  account: StatementAccount;
  rows: Array<Omit<NormalizedTx, 'id'>>;
  /** The balance after the newest row, when the file states it. */
  closingBalance: number | null;
}

/**
 * Why a file was not taken — a code the UI words, never text from the file: no reader knows it, two readers claim it,
 * another bank's statement than the connection's, a language whose service texts the rules do not know, a kind of
 * statement not supported yet, no rows, a row that does not read.
 */
export type StatementProblem = 'unknown-format' | 'ambiguous' | 'other-bank' | 'language' | 'unsupported-kind' | 'empty' | 'bad-row';

export type StatementReadResult =
  | { ok: true; /** One per account the file holds. */ statements: ParsedStatement[] }
  | { ok: false; problem: StatementProblem; /** 1-based row of the document, for `bad-row`. */ row?: number };

/** One kind of statement file of one bank. Pure: no file system, no clock. */
export interface StatementReader {
  provider: ProviderId;
  /** Unique among readers, e.g. 'monobank-card-uk'. */
  id: string;
  /** 0 = not mine, 1 = its format and part of its signature, 2 = its whole signature. */
  detect(doc: StatementDocument): 0 | 1 | 2;
  read(doc: StatementDocument): StatementReadResult;
}
