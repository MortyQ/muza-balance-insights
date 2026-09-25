// «Проверять обновления» — one boolean in userData/preferences.json (on by default). Not data: «Delete all data»
// leaves it; a broken or foreign file reads as the default.
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';

export const PREFS_FILE = 'preferences.json';
const Prefs = z.object({ updateChecks: z.boolean() });
export type Prefs = z.infer<typeof Prefs>;
const DEFAULTS: Prefs = { updateChecks: true };

export function readPrefs(userDataDir: string): Prefs {
  try {
    const p = Prefs.safeParse(JSON.parse(fs.readFileSync(path.join(userDataDir, PREFS_FILE), 'utf8')));
    return p.success ? p.data : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

export async function writePrefs(userDataDir: string, prefs: Prefs): Promise<void> {
  const file = path.join(userDataDir, PREFS_FILE);
  await fs.promises.writeFile(`${file}.tmp`, JSON.stringify(Prefs.parse(prefs)));
  await fs.promises.rename(`${file}.tmp`, file);
}
