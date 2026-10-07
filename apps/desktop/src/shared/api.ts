// Types of window.balance as the renderer sees it (implemented by the preload + main handlers). Plain types only.
import type { AutoSyncSettings } from './auto-sync.ts';
import type { AccountName } from './account-name.ts';
import type { CategoryId } from './categories.ts';
import type { ColorKey } from './colors.ts';
import type { DbStateView, StartOverResult } from './db-state.ts';
import type { Locale } from './locale.ts';
import type { DisableAuth, LockResult, LockTriggers, LockView } from './lock.ts';
import type { ImportProgress, StartImportResult } from './progress.ts';
import type { ThemePref } from './theme.ts';
import type { UpdateView } from './update.ts';

export type TokenStatus = {
  present: boolean;
  /** Where the current token lives: an encrypted file, or only this session's memory. */
  stored: 'secure' | 'memory' | null;
  /** Whether this machine can store it safely at all (drives the UI notice). */
  secureStorage: boolean;
  /** A saved token could not be decrypted (e.g. a rebuilt unsigned macOS app) and was removed: ask for it again. */
  needsReentry: boolean;
};

// ---------- people and connections ----------
// A participant's label is the one name that reaches the renderer (typed by the user, or the holder's name from the
// bank): the screen shows it. Nothing else of a connection — no holder id, no token.

/** Must equal the core's ProviderId (checked in src/main/integrations.ts). */
export type ProviderKey = 'monobank';

export type { ColorKey };

export type ConnectionView = {
  id: number;
  provider: ProviderKey;
  /** «Monobank». */
  bank: string;
  accounts: number;
  /** Of `accounts`, the ones imported and counted («Счета» toggles). */
  enabledAccounts: number;
  /** Dates (system time zone, see dates.ts) covered by all its imported accounts; null = not imported yet. */
  coveredFrom: string | null;
  coveredTo: string | null;
  lastSyncAt: string | null;
  token: TokenStatus;
};

export type PersonView = {
  id: number;
  label: string;
  /** The label is the holder's name from the bank (until the user renames). */
  labelFromBank: boolean;
  /** Waiting for the bank's name (added with «Use the name from the bank», not imported yet): the renderer words it. */
  labelPending: boolean;
  /** null = none (the palette ran out). */
  color: ColorKey | null;
  connections: ConnectionView[];
};

export type PeopleView = {
  people: PersonView[];
  /** Whether tokens can be remembered on this machine at all. */
  secureStorage: boolean;
};

/**
 * Who the new connection belongs to: an existing participant, a new one with a name, or a new one named by the bank.
 * A new one's colour: the one given (must be free), else the first free one.
 */
export type ParticipantChoice = { id: number } | { label: string; color?: ColorKey } | { fromBank: true; color?: ColorKey };

export type AddConnectionInput = { participant: ParticipantChoice; provider: ProviderKey; token: string; remember: boolean };

/** taken: another person has this colour. */
export type ColorChangeResult = { changed: true } | { changed: false; reason: 'taken' };

export type AddConnectionResult =
  | { added: true; connectionId: number; participantId: number; stored: 'secure' | 'memory' }
  /** duplicate: this very token is already a connection. */
  | { added: false; reason: 'duplicate' };

/** A service the app may reach (src/net/allowlist.ts); ids must equal its ServiceId (checked in src/main/services.ts). */
export type TrustedServiceView = { id: 'github' | 'monobank' | 'monobank-rates'; hosts: string[] };

export type RemoveConnectionResult = { removed: true } | { removed: false; reason: 'import-running' | 'cancelled' };

/**
 * One account of a connection for its toggle (core listConnectionAccounts): the parts of its label only — never the
 * IBAN or the full card number.
 */
export type ConnectionAccountView = {
  id: string;
  kind: 'card' | 'jar';
  /** The bank's account type (Monobank: black / white / fop …); null for jars. */
  type: string | null;
  currencyCode: number;
  /** Last 4 digits of the card number; null for jars or when the bank sent none. */
  maskedPanTail: string | null;
  /** A jar's title; null for cards. */
  jarTitle: string | null;
  /** Imported and counted in every statistic. */
  enabled: boolean;
  /** No choice made yet: `enabled` follows the default rule (a card always; a jar with money or already imported). */
  auto: boolean;
};

export type SetAccountEnabledResult = { changed: true } | { changed: false; reason: 'import-running' };

export type BalanceApi = {
  listPeople(): Promise<PeopleView>;
  /** Creates the participant (if new) and the connection, keeps the token. Does not start an import. */
  addConnection(input: AddConnectionInput): Promise<AddConnectionResult>;
  /** The user's name wins from now on: the bank no longer changes it. */
  renameParticipant(id: number, label: string): Promise<void>;
  /** «Взять имя из банка»: the bank names the person again; its last holder's name applies at once, if it sent one. */
  restoreBankName(id: number): Promise<void>;
  setParticipantColor(id: number, color: ColorKey): Promise<ColorChangeResult>;
  setConnectionToken(connectionId: number, token: string, remember: boolean): Promise<{ stored: 'secure' | 'memory' }>;
  /** System dialog first; deletes the connection's accounts and operations (a participant left without one goes too). */
  removeConnection(connectionId: number): Promise<RemoveConnectionResult>;
  /** Cards first. Unknown connection → error. */
  listConnectionAccounts(connectionId: number): Promise<ConnectionAccountView[]>;
  /**
   * The user's choice, kept until changed. A disabled account is not imported and is in no statistic; its data stays
   * and counts again once enabled. Refused while an import runs. The caller refreshes what it shows (data status).
   */
  setAccountEnabled(accountId: string, enabled: boolean): Promise<SetAccountEnabledResult>;
  /** From the start of the day `from` (YYYY-MM-DD in the system time zone, within isImportFrom) up to now. */
  startImport(from: string): Promise<StartImportResult>;
  cancelImport(): Promise<void>;
  /** Returns an unsubscribe function. */
  onProgress(cb: (p: ImportProgress) => void): () => void;
  /** The «Настройки…» menu item. Returns an unsubscribe function. */
  onOpenSettings(cb: () => void): () => void;
  getSpendingOverview(q: SpendingOverviewQuery): Promise<SpendingOverview>;
  getNowOverview(q: NowOverviewQuery): Promise<NowOverview>;
  getCategoryOverview(q: CategoryOverviewQuery): Promise<CategoryOverview>;
  getIncomeOverview(q: IncomeOverviewQuery): Promise<IncomeOverview>;
  getAnalyticsOverview(q: AnalyticsQuery): Promise<AnalyticsOverview>;
  getMonthOverview(q: MonthOverviewQuery): Promise<MonthOverview>;
  getSyncStatus(): Promise<DataStatus>;
  /** Asks for confirmation in a system dialog first; false = the user said no. */
  deleteAllData(): Promise<{ deleted: boolean }>;
  getUpdate(): Promise<UpdateView>;
  checkForUpdates(): Promise<UpdateView>;
  /** manual mode: download, verify and save to Downloads (auto mode downloads by itself). */
  downloadUpdate(): Promise<UpdateView>;
  /** auto mode, `ready` only: quits and installs. Refused while an import runs. */
  installUpdate(): Promise<{ started: boolean; reason?: 'import-running' | 'not-ready' }>;
  setUpdateChecks(enabled: boolean): Promise<UpdateView>;
  /** Returns an unsubscribe function. */
  onUpdate(cb: (v: UpdateView) => void): () => void;
  /** Allowed while locked. */
  getLockState(): Promise<LockView>;
  /** Allowed while locked. A wrong PIN counts towards the pause. */
  unlockWithPin(pin: string): Promise<LockResult>;
  /** Allowed while locked. macOS only; the system prompt may fall back to the Mac password. */
  unlockWithTouchId(): Promise<LockResult>;
  /** «Заблокировать сейчас»; a no-op while the lock is off. */
  lockNow(): Promise<void>;
  /** Sets the first PIN (all triggers on). Refused for a weak PIN. */
  enableLock(pin: string): Promise<LockView>;
  changePin(current: string, next: string): Promise<LockResult>;
  disableLock(auth: DisableAuth): Promise<LockResult>;
  setLockTriggers(triggers: LockTriggers): Promise<LockView>;
  setTouchId(enabled: boolean): Promise<LockView>;
  /** Returns an unsubscribe function. */
  onLock(cb: (v: LockView) => void): () => void;
  /** «Автосинхронизация»: the main switch and its triggers (userData/preferences.json). */
  getAutoSync(): Promise<AutoSyncSettings>;
  /** Applies from the next trigger; returns what was saved. */
  setAutoSync(settings: AutoSyncSettings): Promise<AutoSyncSettings>;
  /** The hosts the app may reach, for the settings screen. */
  getTrustedServices(): Promise<TrustedServiceView[]>;
  getTheme(): Promise<ThemePref>;
  /** Saves and applies at once: the frame, native dialogs and the page's prefers-color-scheme follow. */
  setTheme(theme: ThemePref): Promise<ThemePref>;
  /** The chosen language, or the system's until one is chosen. Not applied yet: the texts are not translated. */
  getLocale(): Promise<Locale>;
  setLocale(locale: Locale): Promise<Locale>;
  /** Allowed while the database is not ready (not while locked). */
  getDbState(): Promise<DbStateView>;
  /** Database not ready only: a new process asks the keychain again. */
  relaunchApp(): Promise<void>;
  /** Database not ready only; system dialog first. A new empty database; tokens that still decrypt become connections. */
  startOver(): Promise<StartOverResult>;
  quitApp(): Promise<void>;
  /** Returns an unsubscribe function. */
  onDbState(cb: (v: DbStateView) => void): () => void;
};

// ---------- data for the screen ----------
// All amounts are integer minor units of `currency` (ISO 4217 numeric); currencies are never summed together.
// No names, descriptions, card numbers or IBANs: categories and account name parts only — except the lines of
// CategoryOverview and IncomeOverview, which carry the bank's description and comment of each operation (the category
// and income screens; nothing else).
// participantId: one participant's view; absent — the whole family.

export type Scope = 'personal' | 'business';

export type SpendingOverviewQuery = { month: string; scope: Scope; participantId?: number };

/** Hryvnia kopecks (account currencies folded by today's rates) and spending lines. */
export type SpendingAmounts = { net: number; purchases: number };

export type SpendingPersonPart = SpendingAmounts & {
  participantId: number;
  /** The comparison period; null — no comparison. */
  prev: SpendingAmounts | null;
};

export type SpendingCategoryView = SpendingAmounts & {
  /** The core's word; `categoryId` — its CATEGORY key (null: a word the core no longer has). */
  category: string;
  categoryId: CategoryId | null;
  prev: SpendingAmounts | null;
  /** The family view only (no participantId, more than one participant): each participant's part, in listParticipants order; else []. */
  people: SpendingPersonPart[];
};

/**
 * Today's Monobank rates (public /bank/currency): hryvnia kopecks per minor unit of each quoted currency — the bank's
 * sell rate, or its cross rate for a currency it quotes only so. One snapshot for every amount of an answer.
 */
export type RatesView = {
  list: Array<{ currency: number; rate: number }>;
  /** Epoch seconds of the fetch these rates come from. */
  fetchedAt: number;
  /** The latest refresh failed: these are the saved rates. */
  saved: boolean;
};

export type SpendingOverview = {
  month: string;
  period: {
    from: string;
    to: string;
    days: number;
    /** The period ends after the last sync (or in the future): numbers will still grow. */
    incomplete: boolean;
    /** Date the data reaches in the system time zone (see core periodInfo); null = never imported. */
    dataUntil: string | null;
    coveredDays: number;
    pendingHolds: number;
  };
  /** The period compared with: last month, cut to the same day while this one is incomplete; null — not covered. */
  compare: { from: string; to: string; partial: boolean } | null;
  total: SpendingAmounts & { prev: SpendingAmounts | null };
  /**
   * Family view only (more than one participant): each participant's sum over the family's categories (they add up to `total`). With
   * foreign-currency spending they may differ from it by a few kopecks: each group is rounded on its own.
   */
  people: SpendingPersonPart[];
  /** net > 0 only, net desc; a refund-only category is left out here but counts in `total`. */
  categories: SpendingCategoryView[];
  /** Today's rates every amount of this answer was folded by; null — never fetched (foreign parts are in leftOut). */
  rates: RatesView | null;
  /** Account currencies without any rate: left out of every sum. Minor units of that currency. */
  leftOut: Array<{ currency: number; net: number }>;
  /** With participantId and more than one participant: the family's net for the same month and scope; else null. */
  familyTotal: number | null;
};

/**
 * The period of a detail screen: one day, a week from its Monday, a whole month (system time zone). Main refuses a week
 * that does not start on a Monday and a period that starts after today.
 */
export type DetailPeriod = { kind: 'day'; date: string } | { kind: 'week'; from: string } | { kind: 'month'; month: string };

export type CategoryOverviewQuery = { period: DetailPeriod; category: CategoryId; scope: Scope; participantId?: number };

/** One spending line of the category screen: a transaction's body, or its commission as a «Bank fees» line. */
export type CategoryLineView = {
  /** Unique per line: the transaction's id, «:fee» for its commission line. */
  key: string;
  /** System time zone: YYYY-MM-DD, HH:mm, ISO weekday (Monday = 1). */
  date: string;
  time: string;
  weekday: number;
  /**
   * The bank's description of the operation ('' — none; a card number cut to its last digits, a jar's title hidden)
   * and its comment. Descriptions leave main only here and in IncomeLineView: the user's own category and income screens.
   */
  merchant: string;
  comment: string | null;
  participantId: number;
  account: AccountName;
  /** Hryvnia kopecks by today's rate, sign kept (< 0 spending, > 0 a refund); null — no rate for the currency. */
  uah: number | null;
  /** The account currency and its minor units, sign kept. */
  currency: number;
  amount: number;
  /** The operation's own currency and amount when it differs from the account's. */
  operation: { currency: number; amount: number } | null;
  commission: boolean;
  hold: boolean;
  /** A hold of the last 3 days: it may still change. */
  pending: boolean;
  refund: boolean;
  /** A purchase whose refund the bank paired with it. */
  refunded: boolean;
  /** Cashback in hryvnia kopecks (0 — none or no rate). */
  cashback: number;
};

/**
 * The category screen: one category in one month, scope and person (or the family), hryvnia kopecks by today's rates
 * — the same lines as the spending block's figure. Weekdays, hours and days are the system time zone's.
 */
export type CategoryOverview = {
  /** The period asked for. */
  range: DetailPeriod;
  category: string;
  categoryId: CategoryId;
  period: SpendingOverview['period'];
  compare: SpendingOverview['compare'];
  summary: SpendingAmounts & {
    gross: number;
    refunds: number;
    /** The compared period's net and purchases; null — not covered. */
    prev: SpendingAmounts | null;
    /** Median spending line; null — none. */
    median: number | null;
    /** net per covered day; null — no covered day. */
    perDay: number | null;
    /** Days with a spending line. */
    activeDays: number;
    /** Key of the largest spending line; null — none. */
    largest: string | null;
    cashback: number;
    cashbackLines: number;
    /** Of the scope's spending this month (0…1), and the category's place among them (1 = largest); null — none. */
    share: number | null;
    rank: number | null;
  };
  /**
   * A month only (else empty): 12 months up to the current one while the month is among its last 12, else up to it;
   * net null before the data starts.
   */
  months: Array<{ month: string; net: number | null }>;
  /** The current month (YYYY-MM) in the system time zone: still running, so not in the months' average. */
  thisMonth: string;
  /** The family view with more than one person only: each person's part. */
  people: Array<SpendingAmounts & { participantId: number }>;
  /** By the bank's description (case-insensitive), net desc. */
  merchants: Array<SpendingAmounts & { name: string }>;
  /** Newest first; the screen counts «When» from them (weekday, time, date), so a merchant filter narrows it too. */
  lines: CategoryLineView[];
  rates: RatesView | null;
  /** Account currencies without any rate: left out of every sum. Minor units of that currency. */
  leftOut: Array<{ currency: number; net: number }>;
};

export type IncomeOverviewQuery = { period: DetailPeriod; participantId?: number };

/** Where a credit came from, by its shape (core incomeSource): another bank, a named sender, a transfer, family, other. */
export type IncomeSourceId = 'other_bank' | 'named_sender' | 'transfer' | 'family' | 'other';

/** Hryvnia kopecks (account currencies folded by today's rates) and income lines. */
export type IncomeAmounts = { total: number; lines: number };

/** One line of the income screen. */
export type IncomeLineView = {
  /** The transaction's id. */
  key: string;
  /** System time zone: YYYY-MM-DD, HH:mm, ISO weekday (Monday = 1). */
  date: string;
  time: string;
  weekday: number;
  /**
   * Who sent it: a named transfer's name, else the bank's description (a card number cut to its last digits, a jar's
   * title hidden); '' — none. With the comment, the only text of the income screen.
   */
  sender: string;
  comment: string | null;
  source: IncomeSourceId;
  participantId: number;
  account: AccountName;
  /** Hryvnia kopecks by today's rate, > 0; null — no rate for the currency. */
  uah: number | null;
  /** The account currency and its minor units. */
  currency: number;
  amount: number;
  /** The operation's own currency and amount when it differs from the account's. */
  operation: { currency: number; amount: number } | null;
  hold: boolean;
  /** A hold of the last 3 days: it may still change. */
  pending: boolean;
};

/**
 * The income screen: one month's income of a person (or the family), all scopes, hryvnia kopecks by today's rates —
 * the balances' «Income» figure. Weekdays, hours and days are the system time zone's.
 */
export type IncomeOverview = {
  /** The period asked for. */
  range: DetailPeriod;
  period: SpendingOverview['period'];
  compare: SpendingOverview['compare'];
  summary: IncomeAmounts & {
    /** The compared period's; null — not covered. */
    prev: IncomeAmounts | null;
    /** Median line; null — none. */
    median: number | null;
    /** total per covered day; null — no covered day. */
    perDay: number | null;
    /** Days with income. */
    activeDays: number;
    /** Key of the largest line; null — none. */
    largest: string | null;
    /** The period's spending, all scopes (the balances' «Spent»), to say how much of the income went. */
    spending: number;
  };
  /** As CategoryOverview's months (a month only, else empty): up to the current month while the month is among its last 12; null before the data. */
  months: Array<{ month: string; total: number | null }>;
  /** The current month (YYYY-MM) in the system time zone: still running, so not in the months' average. */
  thisMonth: string;
  /** The family view with more than one person only: each person's part. */
  people: Array<IncomeAmounts & { participantId: number }>;
  /** By source, total desc. */
  sources: Array<IncomeAmounts & { source: IncomeSourceId }>;
  /** By sender (case-insensitive), total desc. */
  senders: Array<IncomeAmounts & { name: string }>;
  /** Newest first; the screen counts «When» from them. */
  lines: IncomeLineView[];
  rates: RatesView | null;
  /** Account currencies without any rate: left out of every sum. Minor units of that currency. */
  leftOut: Array<{ currency: number; total: number }>;
};

/** The analytics screen: whole months `YYYY-MM`, from ≤ to, at most ANALYTICS_MAX_MONTHS (src/shared/analytics.ts). One month = from === to. */
export type AnalyticsQuery = { from: string; to: string; participantId?: number };

/** full — data for the whole bucket; running — the current month / today; none — before the first data or after today (values 0, not drawn). */
export type AnalyticsBucketState = 'full' | 'running' | 'none';

export type AnalyticsCategory = {
  category: string;
  categoryId: CategoryId | null;
  /** Hryvnia kopecks per bucket, in `buckets` order. */
  net: number[];
  total: number;
  /** The comparison period's spending; null — no comparison. */
  prev: number | null;
};

/**
 * The analytics screen: income and spending (all scopes, the balances' fold) of a person or the family, hryvnia kopecks by
 * today's rates, per day (one month) or month (a range). Categories, numbers and dates only — no bank text.
 */
export type AnalyticsOverview = {
  from: string;
  to: string;
  unit: 'day' | 'month';
  /** `YYYY-MM-DD` (day) or `YYYY-MM` (month), oldest first. */
  buckets: Array<{ key: string; state: AnalyticsBucketState }>;
  income: number[];
  /** The sum of the listed categories per bucket. */
  spending: number[];
  totals: { income: number; spending: number; prev: { income: number; spending: number } | null };
  /** Dates; one month — last month (cut to the same day while this one runs); a range — the same number of months before. */
  compare: { from: string; to: string; partial: boolean } | null;
  /** Day only: the usual month's running spending by day — the mean of up to 3 whole months before; null without them. */
  usual: number[] | null;
  /** Spending categories of either period: this period's ranking first (net > 0, net desc), then the others by `prev`. */
  categories: AnalyticsCategory[];
  rates: RatesView | null;
  /** Account currencies left out (no rate today). */
  leftOut: number[];
};

export type NowOverviewQuery = { participantId?: number };

/** A spending category of the «Now» strip; `rank` — its place in this month's categories (the spending block's colour), null — not among them. */
export type NowCategory = SpendingAmounts & { category: string; categoryId: CategoryId | null; rank: number | null };

/**
 * The «Now» strip: today and this calendar week (from Monday), personal scope, hryvnia kopecks folded by today's
 * rates — the same aggregate as the spending block. Main's clock in the system time zone decides «today».
 */
export type NowOverview = {
  /** The date main counted as today (system time zone). */
  date: string;
  /** 1 = Monday … 7 = Sunday. */
  weekday: number;
  /** Date the data reaches in the system time zone (core periodInfo); null — never imported. */
  dataUntil: string | null;
  today: SpendingAmounts;
  /** Today's spending categories: net > 0, net desc. */
  todayCategories: NowCategory[];
  /**
   * Median of daily net over the 30 days before today that the data covers (a day without spending counts as 0);
   * null — fewer than 7 such days.
   */
  usualDay: number | null;
  week: {
    /** Monday. */
    from: string;
    /** Net of Monday … Sunday; null for the days after today. */
    days: Array<number | null>;
    /** Monday … today (the sum of the week's categories). */
    total: SpendingAmounts;
    /** Net of last week's Monday … the same weekday; null — the data does not reach that Monday. */
    prev: number | null;
    /**
     * The category with the largest net this week; `rank` — its place in this month's categories (the spending
     * block's colour), null — not among them. Null — no spending this week.
     */
    top: NowCategory | null;
    /**
     * The week's spending categories (net > 0, net desc); `prev` — the category's net over the same days as `prev`,
     * null when `prev` is null.
     */
    categories: Array<NowCategory & { prev: number | null }>;
    pendingHolds: number;
  };
  /** Today's rates every amount of this answer was folded by; null — never fetched (foreign parts are left out). */
  rates: RatesView | null;
};

export type MonthOverviewQuery = { month: string; participantId?: number };

/** Minor units: income and spending of the month (the core aggregates, all scopes). */
export type FlowView = { income: number; spending: number };

/** A foreign-currency part of a card's income / spending, converted to hryvnia at today's rate. */
export type FxPart = {
  currency: number;
  /** Minor units of `currency`. */
  income: number;
  spending: number;
  /** Today's rate (hryvnia kopecks per minor unit); null — not quoted / no rates yet, the part is left out of the sums. */
  rate: number | null;
};

/** Income / spending: hryvnia, foreign parts converted by `fx`. */
export type CardTotal = FlowView & {
  /** Foreign-currency parts of income / spending (never hryvnia; parts with nothing in either are left out). */
  fx: FxPart[];
  /** Own funds in hryvnia at the end of the month, foreign accounts folded in at today's rate (accounts with data only). */
  ownFunds: number;
  /** Foreign-currency own funds, each with today's rate; rate null — left out of ownFunds. */
  others: Array<{ currency: number; ownFunds: number; rate: number | null }>;
  /** Accounts without data at that date. */
  missing: number;
  /** All accounts behind the card, with data or without. */
  accounts: number;
};

export type OverviewAccount = FlowView & {
  id: string;
  /** Never a card number or a jar title. */
  name: AccountName;
  kind: 'card' | 'jar';
  currency: number;
  creditLimit: number;
  /** null — no data at that date. Income / spending are in the account's currency. */
  ownFunds: number | null;
};

export type MonthOverview = {
  month: string;
  /** 'now' for the current month, else the month's last day YYYY-MM-DD. */
  balanceAt: 'now' | string;
  /** Dates of the month actually covered by data; clamped so `from` ≤ `to` even with no covered day at all. */
  coverage: { from: string; to: string };
  total: CardTotal;
  /** The whole family only: each person in their own view of transfers. */
  people: Array<{ participantId: number; label: string; labelPending: boolean; color: ColorKey | null; total: CardTotal }>;
  /** One person only: their accounts. */
  accounts: OverviewAccount[];
  /** Today's rates every amount of this answer was folded by; null — never fetched (foreign parts are left out). */
  rates: RatesView | null;
};

export type DataStatus = {
  /** At least one account has been imported. */
  hasData: boolean;
  /** «YYYY-MM-DD HH:mm» (system time zone) up to which every imported account is covered. */
  dataUntil: string | null;
  /** Date (system time zone) the data starts at; null = never imported. */
  dataFrom: string | null;
  lastSyncAt: string | null;
};
