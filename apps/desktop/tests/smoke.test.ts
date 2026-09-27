// The same smoke as in Electron main, on plain Node: the logic is right. The Electron run proves the ABI part.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { SCHEMA_VERSION } from '@mono/core/db';
import { openLibsql } from '@mono/db-libsql';
import { runDbSmoke } from '../src/main/smoke.ts';

const KEY = 'c0ffee'.padEnd(64, '0');

let dir: string | undefined;
afterEach(() => {
  if (dir) fs.rmSync(dir, { recursive: true, force: true });
  dir = undefined;
});

describe('libsql smoke', () => {
  it('opens :memory: and the database through the given opener (encrypted here), applies migrations', async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'desktop-smoke-'));
    const file = path.join(dir, 'monobank.db');
    const r = await runDbSmoke(() => openLibsql(`file:${file}`, { encryptionKey: KEY }), true, 1_700_000_000);
    expect(r).toMatchObject({ ok: true, memory: 42, fileSchema: SCHEMA_VERSION, expectedSchema: SCHEMA_VERSION, encrypted: true });
    expect(fs.readFileSync(file).subarray(0, 15).toString('latin1')).not.toBe('SQLite format 3');
  });

  it('reports a failure by the error name only — no message, no stack', async () => {
    const r = await runDbSmoke(async () => {
      throw new Error(`secret ${KEY}\n    at somewhere`);
    }, false, 0);
    expect(r).toEqual({ ok: false, error: 'Error' });
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
