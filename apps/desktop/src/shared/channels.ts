// The whole renderer ↔ main surface. No dependencies: the sandboxed preload bundles this file as is.
// Adding a method = one line here + a zod schema in src/main/ipc.ts (typecheck enforces both) + a handler.

export const METHODS = [
  'setToken',
  'clearToken',
  'hasToken',
  'listPeople',
  'addConnection',
  'renameParticipant',
  'setConnectionToken',
  'removeConnection',
  'startImport',
  'cancelImport',
  'spendingSummary',
  'getBalances',
  'getSyncStatus',
  'deleteAllData',
  'getUpdate',
  'checkForUpdates',
  'downloadUpdate',
  'installUpdate',
  'setUpdateChecks',
] as const;

export type Method = (typeof METHODS)[number];

export const CHANNEL_PREFIX = 'balance:';
export const channel = (m: Method): string => `${CHANNEL_PREFIX}${m}`;

/** main → renderer only (import progress). */
export const PROGRESS_CHANNEL = `${CHANNEL_PREFIX}progress`;

/** main → renderer only: the app-update view (src/shared/update.ts) whenever it changes. */
export const UPDATE_CHANNEL = `${CHANNEL_PREFIX}update`;

/** main → renderer only, no payload: the «Настройки…» menu item (Cmd/Ctrl+,). */
export const OPEN_SETTINGS_CHANNEL = `${CHANNEL_PREFIX}open-settings`;

/** The name of the API object in the renderer: window.balance. */
export const API_KEY = 'balance';
