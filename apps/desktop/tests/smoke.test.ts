// The same smoke as in Electron main, on plain Node: the logic is right. The Electron run proves the ABI part.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { SCHEMA_VERSION } from '@mono/core/db';
import { runDbSmoke } from '../src/main/smoke.ts';

let dir: string | undefined;
afterEach(() => {
  if (dir) fs.rmSync(dir, { recursive: true, force: true });
  dir = undefined;
});

describe('libsql smoke', () => {
  it('opens :memory: and a file in userData, applies migrations', async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'desktop-smoke-'));
    const r = await runDbSmoke(path.join(dir, 'userData'), 1_700_000_000);
    expect(r).toMatchObject({ ok: true, memory: 42, fileSchema: SCHEMA_VERSION, expectedSchema: SCHEMA_VERSION, dbFile: 'monobank.db' });
    expect(fs.existsSync(path.join(dir, 'userData', 'monobank.db'))).toBe(true);
  });

  it('reports a failure instead of throwing, without a stack', async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'desktop-smoke-'));
    const blocker = path.join(dir, 'file-not-dir');
    fs.writeFileSync(blocker, '');
    const r = await runDbSmoke(blocker, 0); // userData is a file → mkdir fails
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).not.toMatch(/\n\s+at /);
  });
});

describe('bundling config', () => {
  it('@mono/* are bundled into main (TS sources), libsql stays external', () => {
    const cfg = fs.readFileSync(new URL('../electron.vite.config.ts', import.meta.url), 'utf8');
    const m = /externalizeDeps:\s*\{\s*exclude:\s*\[([^\]]*)\]\s*\}/.exec(cfg);
    expect(m).not.toBeNull();
    const excluded = [...m![1]!.matchAll(/'([^']+)'/g)].map((x) => x[1]);
    expect(excluded).toEqual(['@mono/core', '@mono/db-libsql']);
  });
});
