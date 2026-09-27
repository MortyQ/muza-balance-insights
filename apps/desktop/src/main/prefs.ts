// The app's preferences in userData/preferences.json: «Проверять обновления» and «Автообновление» (all on by default).
// Not data: «Delete all data» leaves it. Each field falls back to its own default, so a file of an older version (or a
// broken field) never resets the others; a broken or foreign file reads as the defaults.
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { DEFAULT_AUTO_SYNC } from '../shared/auto-sync.ts';

export const PREFS_FILE = 'preferences.json';

const on = z.boolean().catch(true);
const Prefs = z.object({
  updateChecks: on,
  autoSync: z
    .object({
      enabled: on,
      triggers: z.object({ launch: on, wake: on, interval: on }).catch(DEFAULT_AUTO_SYNC.triggers),
    })
    .catch(DEFAULT_AUTO_SYNC),
});
export type Prefs = z.infer<typeof Prefs>;

export function readPrefs(userDataDir: string): Prefs {
  let raw: unknown = {};
  try {
    raw = JSON.parse(fs.readFileSync(path.join(userDataDir, PREFS_FILE), 'utf8'));
  } catch {
    // missing or broken: the defaults
  }
  return Prefs.parse(raw !== null && typeof raw === 'object' && !Array.isArray(raw) ? raw : {});
}

// One write at a time: two changes in a row must not read the same file and drop one of them.
let queue: Promise<void> = Promise.resolve();

/** Reads the current file, applies `change`, writes it back (tmp + rename). */
export function updatePrefs(userDataDir: string, change: (p: Prefs) => Prefs): Promise<void> {
  const run = queue.then(async () => {
    const file = path.join(userDataDir, PREFS_FILE);
    await fs.promises.writeFile(`${file}.tmp`, JSON.stringify(Prefs.parse(change(readPrefs(userDataDir)))));
    await fs.promises.rename(`${file}.tmp`, file);
  });
  queue = run.catch(() => undefined);
  return run;
}
