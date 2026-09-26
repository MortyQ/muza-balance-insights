// «Удалить все данные»: after a system confirmation, everything the app keeps in userData goes — the database with its
// WAL files, the saved tokens and the unfinished import job. Order: the tokens first (a pending restart can no longer
// get them), then the worker is stopped and the connection closed (nothing holds the files), then the files.
import fs from 'node:fs';
import path from 'node:path';
import { JOB_FILE } from './importer.ts';
import { LEGACY_TOKEN_FILE, TOKENS_DIR } from './token.ts';

export const DB_FILE = 'monobank.db';

/** Every file the app itself writes to userData. Electron's own service files (Preferences, caches) hold no data of ours. */
export const APP_FILES = [
  DB_FILE, `${DB_FILE}-wal`, `${DB_FILE}-shm`, `${DB_FILE}-journal`, JOB_FILE, LEGACY_TOKEN_FILE, `${LEGACY_TOKEN_FILE}.tmp`,
] as const;
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
  for (const f of APP_FILES) await fs.promises.rm(path.join(d.userDataDir, f), { force: true });
  for (const f of APP_DIRS) await fs.promises.rm(path.join(d.userDataDir, f), { recursive: true, force: true });
  const left = [...APP_FILES, ...APP_DIRS].filter((f) => fs.existsSync(path.join(d.userDataDir, f)));
  if (left.length > 0) throw new Error(`files left: ${left.join(', ')}`);
  d.log('all data deleted');
  return { deleted: true };
}
