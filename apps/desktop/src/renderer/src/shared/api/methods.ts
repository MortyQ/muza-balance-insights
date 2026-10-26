import type { Method } from '@contract/channels.ts';

/** The data screens' reads: their answers are kept (shared/lib readCache). */
export const CACHED_READS = [
  'getMonthOverview',
  'getSpendingOverview',
  'getNowOverview',
  'getCategoryOverview',
  'getIncomeOverview',
  'getRecurringOverview',
  'getAllowanceOverview',
  'getAnalyticsOverview',
] as const satisfies ReadonlyArray<Method>;
export type CachedRead = (typeof CACHED_READS)[number];

/** Calls that change none of the data the cached reads show: they pass through. */
export const PASS_THROUGH = [
  'listPeople',
  'listConnectionAccounts',
  'openStatement',
  'openAnyStatement',
  'openDroppedStatement',
  'openUpload',
  'openDroppedUpload',
  'assignStatement',
  'compareStatement',
  'startImport',
  'cancelImport',
  'getSyncStatus',
  'getUpdate',
  'checkForUpdates',
  'downloadUpdate',
  'installUpdate',
  'setUpdateChecks',
  'getLockState',
  'unlockWithPin',
  'unlockWithTouchId',
  'lockNow',
  'enableLock',
  'changePin',
  'disableLock',
  'setLockTriggers',
  'setTouchId',
  'getAutoSync',
  'setAutoSync',
  'getTrustedServices',
  'getTheme',
  'setTheme',
  'getLocale',
  'setLocale',
  'getDbState',
  'relaunchApp',
  'quitApp',
] as const satisfies ReadonlyArray<Method>;

/**
 * Writes: a successful one makes every kept answer stale. Any method in neither list above counts as one, so a new
 * write needs no entry here; this list only names them for the test that checks every method is placed.
 */
export const WRITES = [
  'addConnection',
  'renameParticipant',
  'restoreBankName',
  'setParticipantColor',
  'setConnectionToken',
  'removeConnection',
  'setAccountEnabled',
  'commitStatement',
  'commitUpload',
  'setRecurringMark',
  'addReserve',
  'updateReserve',
  'deleteReserve',
  'deleteAllData',
  'startOver',
] as const satisfies ReadonlyArray<Method>;
