// «Удалить все данные»: after a system confirmation, everything the app keeps in userData goes — the database with its
// WAL files, the saved tokens, the unfinished import job and the app lock (a forgotten PIN has no other way out).
// Order: the tokens first (a pending restart can no longer get them), then the worker is stopped and the connection
// closed (nothing holds the files), then the files — the lock last of all, so a failure partway through a wipe never
// leaves the app unlocked over data that is still (partly) there.
import fs from 'node:fs';
import path from 'node:path';
import { JOB_FILE } from './importer.ts';
import { LOCK_FILE } from './lock/store.ts';
import { LEGACY_TOKEN_FILE, TOKENS_DIR } from './token.ts';

export const DB_FILE = 'monobank.db';

/** Everything but the lock file itself, removed first. */
const OTHER_FILES = [DB_FILE, `${DB_FILE}-wal`, `${DB_FILE}-shm`, `${DB_FILE}-journal`, JOB_FILE, LEGACY_TOKEN_FILE, `${LEGACY_TOKEN_FILE}.tmp`] as const;
/** The app lock, removed only after everything else (including APP_DIRS) is gone. */
const LOCK_FILES = [LOCK_FILE, `${LOCK_FILE}.tmp`] as const;
/** Every file the app itself writes to userData. Electron's own service files (Preferences, caches) hold no data of ours. */
export const APP_FILES = [...OTHER_FILES, ...LOCK_FILES] as const;
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
