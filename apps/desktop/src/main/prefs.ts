// App preferences in userData/preferences.json: «Проверять обновления», the theme and the language. Not data: «Delete all data»
// leaves the file. Each field falls back to its own default, so a broken or older file loses nothing else.
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { LOCALES } from '../shared/locale.ts';
import { DEFAULT_THEME, THEME_PREFS } from '../shared/theme.ts';

export const PREFS_FILE = 'preferences.json';
const Stored = z.strictObject({
  updateChecks: z.boolean(),
  theme: z.enum(THEME_PREFS),
  /** null: not chosen, the system's language (resolveLocale). */
  locale: z.enum(LOCALES).nullable(),
});
export type Prefs = z.infer<typeof Stored>;
// Reading forgives: each field on its own.
const Prefs = z.object({
  updateChecks: Stored.shape.updateChecks.catch(true),
  theme: Stored.shape.theme.catch(DEFAULT_THEME),
  locale: Stored.shape.locale.catch(null),
});
const DEFAULTS: Prefs = Prefs.parse({});

export function readPrefs(userDataDir: string): Prefs {
  try {
    const p = Prefs.safeParse(JSON.parse(fs.readFileSync(path.join(userDataDir, PREFS_FILE), 'utf8')));
    return p.success ? p.data : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

// One write at a time: two patches read-modify-write the same file.
let queue: Promise<unknown> = Promise.resolve();

/** Changes the given fields only. An invalid value throws before anything is written. */
export function patchPrefs(userDataDir: string, patch: Partial<Prefs>): Promise<void> {
  const run = queue.then(async () => {
    const next = Stored.parse({ ...readPrefs(userDataDir), ...patch });
    const file = path.join(userDataDir, PREFS_FILE);
    await fs.promises.writeFile(`${file}.tmp`, JSON.stringify(next));
    await fs.promises.rename(`${file}.tmp`, file);
  });
  queue = run.catch(() => undefined);
  return run;
}
