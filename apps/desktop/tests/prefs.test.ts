// userData/preferences.json: «Проверять обновления», «Автосинхронизация», the theme, the language and the allowance reserve. Every field keeps its
// own default, so a file of an older version or a broken field never resets the rest; concurrent changes are not lost;
// an invalid change is refused before anything is written.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { PREFS_FILE, readPrefs, updatePrefs, type Prefs } from '../src/main/prefs.ts';
import { AUTO_SYNC_TRIGGERS, DEFAULT_AUTO_SYNC } from '../src/shared/auto-sync.ts';
import { DEFAULT_THEME } from '../src/shared/theme.ts';

const DEFAULTS = { updateChecks: true, autoSync: DEFAULT_AUTO_SYNC, theme: 'system', locale: null, allowanceReserve: 0 };
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'prefs-'));
const put = (dir: string, text: string) => fs.writeFileSync(path.join(dir, PREFS_FILE), text);

describe('preferences', () => {
  it('defaults: everything on, theme and language follow the system; a missing, broken or foreign file reads as them', () => {
    expect(DEFAULT_THEME).toBe('system');
    const dir = tmp();
    expect(readPrefs(dir)).toEqual(DEFAULTS);
    for (const text of ['{broken', 'null', '[]', '"x"', '42']) {
      put(dir, text);
      expect(readPrefs(dir)).toEqual(DEFAULTS);
    }
  });

  it('a file of an older version keeps its «Проверять обновления» and gets the other defaults', () => {
    const dir = tmp();
    put(dir, JSON.stringify({ updateChecks: false }));
    expect(readPrefs(dir)).toEqual({ ...DEFAULTS, updateChecks: false });
  });

  it('a broken field falls back alone', () => {
    const dir = tmp();
    put(dir, JSON.stringify({ updateChecks: 'no', autoSync: { enabled: false, triggers: { launch: false, wake: 1 } } }));
    expect(readPrefs(dir)).toEqual({ ...DEFAULTS, autoSync: { enabled: false, triggers: { launch: false, wake: true, interval: true } } });
    put(dir, JSON.stringify({ updateChecks: false, autoSync: 'off' }));
    expect(readPrefs(dir)).toEqual({ ...DEFAULTS, updateChecks: false });
    put(dir, JSON.stringify({ updateChecks: false, theme: 'sepia' }));
    expect(readPrefs(dir)).toEqual({ ...DEFAULTS, updateChecks: false });
    put(dir, JSON.stringify({ updateChecks: 'no', theme: 'dark' }));
    expect(readPrefs(dir)).toEqual({ ...DEFAULTS, theme: 'dark' });
  });

  it('the language: a choice, or null for the system language; anything else reads as null', () => {
    const dir = tmp();
    put(dir, '{"locale":"uk"}');
    expect(readPrefs(dir).locale).toBe('uk');
    put(dir, '{"locale":"de"}');
    expect(readPrefs(dir).locale).toBeNull();
  });

  it('the allowance reserve: whole kopecks from 0; anything else reads as 0 and is refused on write', async () => {
    const dir = tmp();
    put(dir, '{"allowanceReserve":250000}');
    expect(readPrefs(dir).allowanceReserve).toBe(250_000);
    for (const bad of ['-1', '1.5', '"100"']) {
      put(dir, `{"allowanceReserve":${bad}}`);
      expect(readPrefs(dir).allowanceReserve).toBe(0);
    }
    await expect(updatePrefs(dir, (p) => ({ ...p, allowanceReserve: -5 }))).rejects.toThrow();
  });

  it('the defaults cover every trigger', () => {
    expect(Object.keys(DEFAULT_AUTO_SYNC.triggers).sort()).toEqual([...AUTO_SYNC_TRIGGERS].sort());
  });

  it('updates round-trip and keep the other fields; changes in a row are not lost', async () => {
    const dir = tmp();
    await Promise.all([
      updatePrefs(dir, (p) => ({ ...p, updateChecks: false })),
      updatePrefs(dir, (p) => ({ ...p, autoSync: { ...p.autoSync, enabled: false } })),
      updatePrefs(dir, (p) => ({ ...p, autoSync: { ...p.autoSync, triggers: { ...p.autoSync.triggers, wake: false } } })),
      updatePrefs(dir, (p) => ({ ...p, theme: 'dark' })),
      updatePrefs(dir, (p) => ({ ...p, locale: 'ru' })),
      updatePrefs(dir, (p) => ({ ...p, allowanceReserve: 500_000 })),
    ]);
    expect(readPrefs(dir)).toEqual({
      updateChecks: false,
      autoSync: { enabled: false, triggers: { launch: true, wake: false, interval: true } },
      theme: 'dark',
      locale: 'ru',
      allowanceReserve: 500_000,
    });
    expect(fs.existsSync(path.join(dir, `${PREFS_FILE}.tmp`))).toBe(false);
  });

  it('a failed update does not block the next one', async () => {
    const dir = tmp();
    await expect(updatePrefs(dir, () => { throw new Error('x'); })).rejects.toThrow('x');
    await updatePrefs(dir, (p) => ({ ...p, updateChecks: false }));
    expect(readPrefs(dir).updateChecks).toBe(false);
  });

  it('an invalid change is refused and nothing is written', async () => {
    const dir = tmp();
    const bad = (change: Record<string, unknown>) => (p: Prefs) => ({ ...p, ...change }) as Prefs;
    await expect(updatePrefs(dir, bad({ theme: 'sepia' }))).rejects.toThrow();
    await expect(updatePrefs(dir, bad({ locale: 'de' }))).rejects.toThrow();
    await expect(updatePrefs(dir, bad({ extra: 1 }))).rejects.toThrow();
    await expect(updatePrefs(dir, bad({ autoSync: { enabled: true, triggers: { launch: true, wake: true } } }))).rejects.toThrow();
    expect(fs.existsSync(path.join(dir, PREFS_FILE))).toBe(false);
  });
});
