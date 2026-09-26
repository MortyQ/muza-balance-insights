// «Удалить все данные»: confirmation first; then token → worker → connection → files; nothing of ours is left.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { APP_DIRS, APP_FILES, deleteAllData } from '../src/main/wipe.ts';

let dir: string;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wipe-'));
  for (const f of APP_FILES) fs.writeFileSync(path.join(dir, f), 'x');
  for (const d of APP_DIRS) {
    fs.mkdirSync(path.join(dir, d));
    fs.writeFileSync(path.join(dir, d, '1.bin'), 'x');
    fs.writeFileSync(path.join(dir, d, '2.bin'), 'x');
  }
  fs.writeFileSync(path.join(dir, 'Preferences'), '{}'); // Electron's own file: not ours, stays
});
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

function deps(confirmed: boolean) {
  const order: string[] = [];
  return {
    order,
    d: {
      confirm: async () => (order.push('confirm'), confirmed),
      tokens: { clearAll: async () => void order.push('token') },
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

  it('covers the database with its WAL files, the tokens of every connection (and the old single token), the import job and the app lock', () => {
    expect([...APP_FILES].sort()).toEqual(
      ['db-key.bin', 'db-key.bin.tmp', 'import-job.json', 'lock.json', 'lock.json.tmp', 'monobank.db', 'monobank.db-journal', 'monobank.db-shm', 'monobank.db-wal', 'token.bin', 'token.bin.tmp'].sort(),
    );
    expect([...APP_DIRS]).toEqual(['tokens']);
  });

  it('files already missing are fine (a fresh install)', async () => {
    for (const f of APP_FILES) fs.rmSync(path.join(dir, f));
    for (const d of APP_DIRS) fs.rmSync(path.join(dir, d), { recursive: true });
    await expect(deleteAllData(deps(true).d)).resolves.toEqual({ deleted: true });
  });

  it('the database key goes right after the tokens, before the worker is stopped and the database removed', async () => {
    const { d, order } = deps(true);
    const rm = vi.spyOn(fs.promises, 'rm').mockImplementation(async (p) => void order.push(`rm:${path.basename(p as string)}`));
    try {
      await deleteAllData(d).catch(() => undefined); // files stay (rm is mocked): only the order matters here
      expect(order.slice(0, 5)).toEqual(['confirm', 'token', 'rm:db-key.bin', 'rm:db-key.bin.tmp', 'importer']);
      expect(order.indexOf('rm:monobank.db')).toBeGreaterThan(order.indexOf('db'));
    } finally {
      rm.mockRestore();
    }
  });

  it('the lock file is removed last of all — a failure partway through never leaves data unlocked', async () => {
    const rm = vi.spyOn(fs.promises, 'rm');
    try {
      await deleteAllData(deps(true).d);
      const removed = rm.mock.calls.map((args) => path.basename(args[0] as string));
      const lockAt = [removed.indexOf('lock.json'), removed.indexOf('lock.json.tmp')];
      const othersAt = removed
        .map((name, i) => [name, i] as const)
        .filter(([name]) => name !== 'lock.json' && name !== 'lock.json.tmp')
        .map(([, i]) => i);
      expect(Math.min(...lockAt)).toBeGreaterThan(Math.max(...othersAt));
    } finally {
      rm.mockRestore();
    }
  });
});
