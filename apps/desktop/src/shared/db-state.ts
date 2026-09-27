// The database state as main, the preload and the renderer see it. Plain types only (no imports): the sandboxed
// preload and the renderer (@contract/db-state.ts) bundle this file as is. No free-form string anywhere — enums,
// booleans and a number — so the key could not travel here even by mistake.

export type DbStatus = 'ready' | 'key-unavailable' | 'key-lost' | 'db-unreadable';
export const DB_STATUSES = ['ready', 'key-unavailable', 'key-lost', 'db-unreadable'] as const satisfies ReadonlyArray<DbStatus>;

export type DbStateView = {
  status: DbStatus;
  encrypted: boolean;
  /** Only when ready and plain: `no-secure-storage` — nowhere to keep a key; `encrypt-pending` — retried next launch. */
  notice: 'no-secure-storage' | 'encrypt-pending' | null;
  /** For the screen's text only. */
  platform: 'darwin' | 'win32' | 'linux' | 'other';
};

export type StartOverResult = { done: true; restoredConnections: number } | { done: false; reason: 'cancelled' | 'not-needed' };
