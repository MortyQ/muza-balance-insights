// Types of window.balance as the renderer sees it (implemented by the preload + main handlers). Plain types only.
import type { AutoSyncSettings } from './auto-sync.ts';
import type { ColorKey } from './colors.ts';
import type { DbStateView, StartOverResult } from './db-state.ts';
import type { Locale } from './locale.ts';
import type { DisableAuth, LockResult, LockTriggers, LockView } from './lock.ts';
import type { ImportDepth, ImportProgress, StartImportResult } from './progress.ts';
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

/** Must equal the core's ProviderId (checked in src/main/people.ts). */
export type ProviderKey = 'monobank';

export type { ColorKey };

export type ConnectionView = {
  id: number;
  provider: ProviderKey;
  /** «Monobank». */
  bank: string;
  /** null = none (the palette ran out). */
  color: ColorKey | null;
  accounts: number;
  /** Kyiv dates covered by all its imported accounts; null = not imported yet. */
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

/** color: the connection's own (must be free), else the first free one. */
export type AddConnectionInput = { participant: ParticipantChoice; provider: ProviderKey; token: string; remember: boolean; color?: ColorKey };

/** taken: another person (or connection) has this colour. */
export type ColorChangeResult = { changed: true } | { changed: false; reason: 'taken' };

export type AddConnectionResult =
  | { added: true; connectionId: number; participantId: number; stored: 'secure' | 'memory' }
  /** duplicate: this very token is already a connection. */
  | { added: false; reason: 'duplicate' };

/** A service the app may reach (src/net/allowlist.ts); ids must equal its ServiceId (checked in src/main/services.ts). */
export type TrustedServiceView = { id: 'github' | 'monobank'; hosts: string[] };

export type RemoveConnectionResult = { removed: true } | { removed: false; reason: 'import-running' | 'cancelled' };

export type BalanceApi = {
  listPeople(): Promise<PeopleView>;
  /** Creates the participant (if new) and the connection, keeps the token. Does not start an import. */
  addConnection(input: AddConnectionInput): Promise<AddConnectionResult>;
  /** The user's name wins from now on: the bank no longer changes it. */
  renameParticipant(id: number, label: string): Promise<void>;
  /** «Взять имя из банка»: the bank names the person again; its last holder's name applies at once, if it sent one. */
  restoreBankName(id: number): Promise<void>;
  setParticipantColor(id: number, color: ColorKey): Promise<ColorChangeResult>;
  setConnectionColor(connectionId: number, color: ColorKey): Promise<ColorChangeResult>;
  setConnectionToken(connectionId: number, token: string, remember: boolean): Promise<{ stored: 'secure' | 'memory' }>;
  /** System dialog first; deletes the connection's accounts and operations (a participant left without one goes too). */
  removeConnection(connectionId: number): Promise<RemoveConnectionResult>;
  startImport(depth: ImportDepth): Promise<StartImportResult>;
  cancelImport(): Promise<void>;
  /** Returns an unsubscribe function. */
  onProgress(cb: (p: ImportProgress) => void): () => void;
  /** The «Настройки…» menu item. Returns an unsubscribe function. */
  onOpenSettings(cb: () => void): () => void;
  spendingSummary(q: SpendingQuery): Promise<SpendingView>;
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
// No names, descriptions, card numbers or IBANs: categories and «black/UAH» labels only.
// participantId: one participant's view; absent — the whole family.

export type Scope = 'personal' | 'business';

export type SpendingQuery = { from: string; to: string; scope?: Scope; participantId?: number };

export type SpendingLine = { category: string; gross: number; refunds: number; net: number };

export type SpendingCurrency = {
  currency: number;
  /** Sorted by net, largest first. */
  categories: SpendingLine[];
  total: SpendingLine & { netPerDay: number | null };
};

export type SpendingView = {
  period: {
    from: string;
    to: string;
    days: number;
    /** The period ends after the last sync (or in the future): numbers will still grow. */
    incomplete: boolean;
    /** Kyiv date the data reaches (see core periodInfo); null = never imported. */
    dataUntil: string | null;
    coveredDays: number;
    pendingHolds: number;
  };
  currencies: SpendingCurrency[];
};

export type MonthOverviewQuery = { month: string; participantId?: number };

/** Hryvnia, minor units: income and spending of the month (the core aggregates, all scopes). */
export type FlowView = { income: number; spending: number };

export type CardTotal = FlowView & {
  /** Own funds in hryvnia at the end of the month (accounts with data only). */
  ownFunds: number;
  /** Other currencies — never summed with hryvnia. */
  others: Array<{ currency: number; ownFunds: number }>;
  /** Accounts without data at that date. */
  missing: number;
};

export type OverviewAccount = FlowView & {
  id: string;
  /** «black/UAH»-style label: never a card number or a jar title. */
  label: string;
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
  /** Kyiv dates of the month actually covered by data. */
  coverage: { from: string; to: string };
  total: CardTotal;
  /** The whole family only: each person in their own view of transfers. */
  people: Array<{ participantId: number; label: string; color: ColorKey | null; total: CardTotal }>;
  /** One person only: their accounts. */
  accounts: OverviewAccount[];
};

export type DataStatus = {
  /** At least one account has been imported. */
  hasData: boolean;
  /** Kyiv «YYYY-MM-DD HH:mm» up to which every imported account is covered. */
  dataUntil: string | null;
  /** Kyiv date the data starts at; null = never imported. */
  dataFrom: string | null;
  lastSyncAt: string | null;
};
