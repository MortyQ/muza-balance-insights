// Types of window.balance as the renderer sees it (implemented by the preload + main handlers). Plain types only.
import type { ImportDepth, ImportProgress, StartImportResult } from './progress.ts';
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

export type ConnectionView = {
  id: number;
  provider: ProviderKey;
  /** «Monobank». */
  bank: string;
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
  connections: ConnectionView[];
};

export type PeopleView = {
  people: PersonView[];
  /** Whether tokens can be remembered on this machine at all. */
  secureStorage: boolean;
};

/** Who the new connection belongs to: an existing participant, a new one with a name, or a new one named by the bank. */
export type ParticipantChoice = { id: number } | { label: string } | { fromBank: true };

export type AddConnectionInput = { participant: ParticipantChoice; provider: ProviderKey; token: string; remember: boolean };

export type AddConnectionResult =
  | { added: true; connectionId: number; participantId: number; stored: 'secure' | 'memory' }
  /** duplicate: this very token is already a connection. */
  | { added: false; reason: 'duplicate' };

export type RemoveConnectionResult = { removed: true } | { removed: false; reason: 'import-running' | 'cancelled' };

export type BalanceApi = {
  setToken(token: string, remember: boolean): Promise<{ stored: 'secure' | 'memory' }>;
  clearToken(): Promise<void>;
  hasToken(): Promise<TokenStatus>;
  listPeople(): Promise<PeopleView>;
  /** Creates the participant (if new) and the connection, keeps the token. Does not start an import. */
  addConnection(input: AddConnectionInput): Promise<AddConnectionResult>;
  /** The user's name wins from now on: the bank no longer changes it. */
  renameParticipant(id: number, label: string): Promise<void>;
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
  getBalances(q?: BalancesQuery): Promise<BalancesView>;
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
};

// ---------- data for the screen ----------
// All amounts are integer minor units of `currency` (ISO 4217 numeric); currencies are never summed together.
// No names, descriptions, card numbers or IBANs: categories and «black/UAH» labels only.
// participantId: one participant's view; absent — the whole family.

export type Scope = 'personal' | 'business';

export type SpendingQuery = { from: string; to: string; scope?: Scope; participantId?: number };

export type BalancesQuery = { participantId?: number };

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

export type BalanceLine = {
  id: string;
  label: string;
  currency: number;
  /** balance − credit limit: the main number. */
  ownFunds: number;
  creditLimit: number;
  /** Kyiv «YYYY-MM-DD HH:mm» of the balance. */
  updatedAt: string;
};

export type BalancesView = {
  cards: BalanceLine[];
  jars: BalanceLine[];
  /** Own funds per currency, cards + jars. */
  totals: Array<{ currency: number; ownFunds: number }>;
};

export type DataStatus = {
  /** At least one account has been imported. */
  hasData: boolean;
  /** Kyiv «YYYY-MM-DD HH:mm» up to which every imported account is covered. */
  dataUntil: string | null;
  lastSyncAt: string | null;
};
