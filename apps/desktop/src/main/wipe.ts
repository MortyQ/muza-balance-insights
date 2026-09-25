// «Удалить все данные»: after a system confirmation, everything the app keeps in userData goes — the database with its
// WAL files, the saved token and the unfinished import job. Order: the token first (a pending restart can no longer
// get it), then the worker is stopped and the connection closed (nothing holds the files), then the files.
import fs from 'node:fs';
import path from 'node:path';
import { JOB_FILE } from './importer.ts';
import { TOKEN_FILE } from './token.ts';

export const DB_FILE = 'monobank.db';

/** Every file the app itself writes to userData. Electron's own service files (Preferences, caches) hold no data of ours. */
export const APP_FILES = [DB_FILE, `${DB_FILE}-wal`, `${DB_FILE}-shm`, `${DB_FILE}-journal`, JOB_FILE, TOKEN_FILE, `${TOKEN_FILE}.tmp`] as const;

export type WipeDeps = {
  /** System dialog; true = the user confirmed. */
  confirm: () => Promise<boolean>;
  tokens: { clear(): Promise<void> };
  importer: { stop(): Promise<void> };
  data: { close(): Promise<void> };
  userDataDir: string;
  log: (msg: string) => void;
};

export async function deleteAllData(d: WipeDeps): Promise<{ deleted: boolean }> {
  if (!(await d.confirm())) return { deleted: false };
  await d.tokens.clear();
  await d.importer.stop();
  await d.data.close();
  for (const f of APP_FILES) await fs.promises.rm(path.join(d.userDataDir, f), { force: true });
  const left = APP_FILES.filter((f) => fs.existsSync(path.join(d.userDataDir, f)));
  if (left.length > 0) throw new Error(`files left: ${left.join(', ')}`);
  d.log('all data deleted');
  return { deleted: true };
}
