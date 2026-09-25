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

export type BalanceApi = {
  setToken(token: string, remember: boolean): Promise<{ stored: 'secure' | 'memory' }>;
  clearToken(): Promise<void>;
  hasToken(): Promise<TokenStatus>;
  startImport(depth: ImportDepth): Promise<StartImportResult>;
  cancelImport(): Promise<void>;
  /** Returns an unsubscribe function. */
  onProgress(cb: (p: ImportProgress) => void): () => void;
  /** The «Настройки…» menu item. Returns an unsubscribe function. */
  onOpenSettings(cb: () => void): () => void;
  spendingSummary(q: SpendingQuery): Promise<SpendingView>;
  getBalances(): Promise<BalancesView>;
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

export type Scope = 'personal' | 'business';

export type SpendingQuery = { from: string; to: string; scope?: Scope };

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
