// userData/preferences.json: «Проверять обновления» and «Автообновление». Every field keeps its own default, so a file
// of an older version or a broken field never resets the rest; concurrent changes are not lost.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { PREFS_FILE, readPrefs, updatePrefs } from '../src/main/prefs.ts';
import { AUTO_SYNC_TRIGGERS, DEFAULT_AUTO_SYNC } from '../src/shared/auto-sync.ts';

const DEFAULTS = { updateChecks: true, autoSync: DEFAULT_AUTO_SYNC };
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'prefs-'));
const put = (dir: string, text: string) => fs.writeFileSync(path.join(dir, PREFS_FILE), text);

describe('preferences', () => {
  it('everything on by default; a missing, broken or foreign file reads as the defaults', () => {
    const dir = tmp();
    expect(readPrefs(dir)).toEqual(DEFAULTS);
    for (const text of ['{broken', 'null', '[]', '"x"', '42']) {
      put(dir, text);
      expect(readPrefs(dir)).toEqual(DEFAULTS);
    }
  });

  it('a file of an older version keeps its «Проверять обновления» and gets the auto-sync defaults', () => {
    const dir = tmp();
    put(dir, JSON.stringify({ updateChecks: false }));
    expect(readPrefs(dir)).toEqual({ updateChecks: false, autoSync: DEFAULT_AUTO_SYNC });
  });

  it('a broken field falls back alone', () => {
    const dir = tmp();
    put(dir, JSON.stringify({ updateChecks: 'no', autoSync: { enabled: false, triggers: { launch: false, wake: 1 } } }));
    expect(readPrefs(dir)).toEqual({ updateChecks: true, autoSync: { enabled: false, triggers: { launch: false, wake: true, interval: true } } });
    put(dir, JSON.stringify({ updateChecks: false, autoSync: 'off' }));
    expect(readPrefs(dir)).toEqual({ updateChecks: false, autoSync: DEFAULT_AUTO_SYNC });
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
    ]);
    expect(readPrefs(dir)).toEqual({ updateChecks: false, autoSync: { enabled: false, triggers: { launch: true, wake: false, interval: true } } });
    expect(fs.existsSync(path.join(dir, `${PREFS_FILE}.tmp`))).toBe(false);
  });

  it('a failed update does not block the next one', async () => {
    const dir = tmp();
    await expect(updatePrefs(dir, () => { throw new Error('x'); })).rejects.toThrow('x');
    await updatePrefs(dir, (p) => ({ ...p, updateChecks: false }));
    expect(readPrefs(dir).updateChecks).toBe(false);
  });
});
