// userData/preferences.json: «Проверять обновления», the theme and the language. Each field falls back to its own default.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { PREFS_FILE, patchPrefs, readPrefs } from '../src/main/prefs.ts';
import { DEFAULT_THEME, THEME_PREFS } from '../src/shared/theme.ts';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'prefs-'));
const write = (dir: string, text: string) => fs.writeFileSync(path.join(dir, PREFS_FILE), text);

describe('preferences', () => {
  it('defaults: update checks on, theme and language follow the system', () => {
    expect(DEFAULT_THEME).toBe('system');
    expect(readPrefs(tmp())).toEqual({ updateChecks: true, theme: 'system', locale: null });
  });

  it.each(['{broken', '42', 'null', '[]'])('%s reads as the defaults', (text) => {
    const dir = tmp();
    write(dir, text);
    expect(readPrefs(dir)).toEqual({ updateChecks: true, theme: 'system', locale: null });
  });

  it('a file from before the theme keeps its update setting', () => {
    const dir = tmp();
    write(dir, '{"updateChecks":false}');
    expect(readPrefs(dir)).toEqual({ updateChecks: false, theme: 'system', locale: null });
  });

  it('one bad field falls back alone', () => {
    const dir = tmp();
    write(dir, '{"updateChecks":false,"theme":"sepia"}');
    expect(readPrefs(dir)).toEqual({ updateChecks: false, theme: 'system', locale: null });
    write(dir, '{"updateChecks":"no","theme":"dark"}');
    expect(readPrefs(dir)).toEqual({ updateChecks: true, theme: 'dark', locale: null });
  });

  it('the language: a choice, or null for the system language; anything else reads as null', () => {
    const dir = tmp();
    write(dir, '{"locale":"uk"}');
    expect(readPrefs(dir).locale).toBe('uk');
    write(dir, '{"locale":"de"}');
    expect(readPrefs(dir).locale).toBeNull();
  });

  it('a patch keeps the other fields', async () => {
    const dir = tmp();
    await patchPrefs(dir, { updateChecks: false });
    await patchPrefs(dir, { theme: 'light' });
    expect(readPrefs(dir)).toEqual({ updateChecks: false, theme: 'light', locale: null });
    await patchPrefs(dir, { updateChecks: true });
    expect(readPrefs(dir)).toEqual({ updateChecks: true, theme: 'light', locale: null });
    await patchPrefs(dir, { locale: 'ru' });
    expect(readPrefs(dir)).toEqual({ updateChecks: true, theme: 'light', locale: 'ru' });
  });

  it('patches issued together all land', async () => {
    const dir = tmp();
    await Promise.all([patchPrefs(dir, { theme: 'dark' }), patchPrefs(dir, { updateChecks: false })]);
    expect(readPrefs(dir)).toEqual({ updateChecks: false, theme: 'dark', locale: null });
  });

  it('an invalid patch is refused and nothing is written', async () => {
    const dir = tmp();
    await expect(patchPrefs(dir, { theme: 'sepia' as (typeof THEME_PREFS)[number] })).rejects.toThrow();
    await expect(patchPrefs(dir, { locale: 'de' as 'en' })).rejects.toThrow();
    expect(fs.existsSync(path.join(dir, PREFS_FILE))).toBe(false);
  });
});
