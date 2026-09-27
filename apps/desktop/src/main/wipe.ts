// «Удалить все данные»: after a system confirmation, everything the app keeps in userData goes — the database with its
// WAL files, the saved tokens, the database key, the unfinished import job and the app lock (a forgotten PIN has no
// other way out). Order: the tokens first (a pending restart can no longer get them), then the database key (a database
// file that fails to go — Windows may hold it — is unreadable already), then the worker is stopped and the connection
// closed (nothing holds the files), then the files — the lock last of all, so a failure partway through a wipe never
// leaves the app unlocked over data that is still (partly) there.
import fs from 'node:fs';
import path from 'node:path';
import { DB_FILE, DB_FILES } from './db/access.ts';
import { DB_KEY_FILE } from './db/key-vault.ts';
import { JOB_FILE } from './importer.ts';
import { LOCK_FILE } from './lock/store.ts';
import { LEGACY_TOKEN_FILE, TOKENS_DIR } from './token.ts';

export { DB_FILE };

/** The database key, removed right after the tokens. */
const KEY_FILES = [DB_KEY_FILE, `${DB_KEY_FILE}.tmp`] as const;
/** Everything but the key and the lock, removed after the worker stopped. */
const OTHER_FILES = [
  ...DB_FILES,
  // A copy of an interrupted encryption (db/encrypt.ts: encryptingFiles).
  `${DB_FILE}.encrypting`, `${DB_FILE}.encrypting-journal`, `${DB_FILE}.encrypting-wal`, `${DB_FILE}.encrypting-shm`,
  JOB_FILE, LEGACY_TOKEN_FILE, `${LEGACY_TOKEN_FILE}.tmp`,
] as const;
/** The app lock, removed only after everything else (including APP_DIRS) is gone. */
const LOCK_FILES = [LOCK_FILE, `${LOCK_FILE}.tmp`] as const;
/** Every file the app itself writes to userData. Electron's own service files (Preferences, caches) hold no data of ours. */
export const APP_FILES = [...KEY_FILES, ...OTHER_FILES, ...LOCK_FILES] as const;
/** Folders of ours, removed with everything in them. */
export const APP_DIRS = [TOKENS_DIR] as const;

export type WipeDeps = {
  /** System dialog; true = the user confirmed. */
  confirm: () => Promise<boolean>;
  tokens: { clearAll(): Promise<void> };
  importer: { stop(): Promise<void> };
  data: { close(): Promise<void> };
  userDataDir: string;
  log: (msg: string) => void;
};

export async function deleteAllData(d: WipeDeps): Promise<{ deleted: boolean }> {
  if (!(await d.confirm())) return { deleted: false };
  await d.tokens.clearAll();
  for (const f of KEY_FILES) await fs.promises.rm(path.join(d.userDataDir, f), { force: true });
  await d.importer.stop();
  await d.data.close();
  for (const f of OTHER_FILES) await fs.promises.rm(path.join(d.userDataDir, f), { force: true });
  for (const f of APP_DIRS) await fs.promises.rm(path.join(d.userDataDir, f), { recursive: true, force: true });
  for (const f of LOCK_FILES) await fs.promises.rm(path.join(d.userDataDir, f), { force: true });
  const left = [...APP_FILES, ...APP_DIRS].filter((f) => fs.existsSync(path.join(d.userDataDir, f)));
  if (left.length > 0) throw new Error(`files left: ${left.join(', ')}`);
  d.log('all data deleted');
  return { deleted: true };
}
