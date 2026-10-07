// The app's preferences in userData/preferences.json: «Проверять обновления», «Автосинхронизация» (all on by default), the
// theme, the language and the reserve of «Available per day» (0 by default). Not data: «Delete all data» leaves it. Each field falls back to its own default, so a file of
// an older version (or a broken field) never resets the others; a broken or foreign file reads as the defaults.
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { ALLOWANCE_RESERVE_CURRENCIES, ALLOWANCE_RESERVE_MAX, NO_RESERVE } from '../shared/allowance.ts';
import { DEFAULT_AUTO_SYNC } from '../shared/auto-sync.ts';
import { LOCALES } from '../shared/locale.ts';
import { DEFAULT_THEME, THEME_PREFS } from '../shared/theme.ts';

export const PREFS_FILE = 'preferences.json';

// Writing is strict: an invalid value throws before anything is written.
const Stored = z.strictObject({
  updateChecks: z.boolean(),
  autoSync: z.strictObject({
    enabled: z.boolean(),
    triggers: z.strictObject({ launch: z.boolean(), wake: z.boolean(), interval: z.boolean() }),
  }),
  theme: z.enum(THEME_PREFS),
  /** null: not chosen, the system's language (resolveLocale). */
  locale: z.enum(LOCALES).nullable(),
  /** «Available per day»: what is kept aside, in the currency it was typed in. */
  allowanceReserve: z.strictObject({
    currency: z.union(ALLOWANCE_RESERVE_CURRENCIES.map((c) => z.literal(c))),
    amount: z.number().int().min(0).max(ALLOWANCE_RESERVE_MAX),
  }),
});
export type Prefs = z.infer<typeof Stored>;

// Reading forgives: each field on its own.
const on = z.boolean().catch(true);
const Read = z.object({
  updateChecks: on,
  autoSync: z
    .object({
      enabled: on,
      triggers: z.object({ launch: on, wake: on, interval: on }).catch(DEFAULT_AUTO_SYNC.triggers),
    })
    .catch(DEFAULT_AUTO_SYNC),
  theme: Stored.shape.theme.catch(DEFAULT_THEME),
  locale: Stored.shape.locale.catch(null),
  // 0.1.9 before the currency: a bare number of hryvnia kopecks.
  allowanceReserve: z
    .union([
      Stored.shape.allowanceReserve,
      z.number().int().min(0).max(ALLOWANCE_RESERVE_MAX).transform((amount) => ({ currency: 980 as const, amount })),
    ])
    .catch(NO_RESERVE),
});

export function readPrefs(userDataDir: string): Prefs {
  let raw: unknown = {};
  try {
    raw = JSON.parse(fs.readFileSync(path.join(userDataDir, PREFS_FILE), 'utf8'));
  } catch {
    // missing or broken: the defaults
  }
  return Read.parse(raw !== null && typeof raw === 'object' && !Array.isArray(raw) ? raw : {});
}

// One write at a time: two changes in a row must not read the same file and drop one of them.
let queue: Promise<void> = Promise.resolve();

/** Reads the current file, applies `change`, writes it back (tmp + rename). An invalid result throws, nothing is written. */
export function updatePrefs(userDataDir: string, change: (p: Prefs) => Prefs): Promise<void> {
  const run = queue.then(async () => {
    const file = path.join(userDataDir, PREFS_FILE);
    const next = Stored.parse(change(readPrefs(userDataDir)));
    await fs.promises.writeFile(`${file}.tmp`, JSON.stringify(next));
    await fs.promises.rename(`${file}.tmp`, file);
  });
  queue = run.catch(() => undefined);
  return run;
}
