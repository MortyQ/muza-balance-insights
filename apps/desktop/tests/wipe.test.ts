// «Удалить все данные»: confirmation first; then token → worker → connection → files; nothing of ours is left.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { APP_FILES, deleteAllData } from '../src/main/wipe.ts';

let dir: string;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wipe-'));
  for (const f of APP_FILES) fs.writeFileSync(path.join(dir, f), 'x');
  fs.writeFileSync(path.join(dir, 'Preferences'), '{}'); // Electron's own file: not ours, stays
});
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

function deps(confirmed: boolean) {
  const order: string[] = [];
  return {
    order,
    d: {
      confirm: async () => (order.push('confirm'), confirmed),
      tokens: { clear: async () => void order.push('token') },
      importer: { stop: async () => void order.push('importer') },
      data: { close: async () => void order.push('db') },
      userDataDir: dir,
      log: (m: string) => void order.push(`log:${m}`),
    },
  };
}

describe('deleteAllData', () => {
  it('the user says no → nothing is touched', async () => {
    const { d, order } = deps(false);
    expect(await deleteAllData(d)).toEqual({ deleted: false });
    expect(order).toEqual(['confirm']);
    for (const f of APP_FILES) expect(fs.existsSync(path.join(dir, f))).toBe(true);
  });

  it('confirmed → token, then worker, then connection, then every app file; Electron files stay', async () => {
    const { d, order } = deps(true);
    expect(await deleteAllData(d)).toEqual({ deleted: true });
    expect(order).toEqual(['confirm', 'token', 'importer', 'db', 'log:all data deleted']);
    expect(fs.readdirSync(dir)).toEqual(['Preferences']);
  });

  it('covers the database with its WAL files, the token (and its temp file) and the import job', () => {
    expect([...APP_FILES].sort()).toEqual(
      ['import-job.json', 'monobank.db', 'monobank.db-journal', 'monobank.db-shm', 'monobank.db-wal', 'token.bin', 'token.bin.tmp'].sort(),
    );
  });

  it('files already missing are fine (a fresh install)', async () => {
    for (const f of APP_FILES) fs.rmSync(path.join(dir, f));
    await expect(deleteAllData(deps(true).d)).resolves.toEqual({ deleted: true });
  });
});
