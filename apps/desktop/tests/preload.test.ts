// The preload with a fake Electron module: what exactly reaches window.balance (Checklist #20).
import fs from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { API_KEY, DB_STATE_CHANNEL, LOCK_CHANNEL, METHODS, OPEN_SETTINGS_CHANNEL, PROGRESS_CHANNEL } from '../src/shared/channels.ts';

const exposed: Array<[string, any]> = [];
const invoked: unknown[][] = [];
const listeners = new Map<string, Function>();

const dropped = new Map<unknown, string>();

vi.mock('electron', () => ({
  // A File the user dropped has its path; one made by script has none.
  webUtils: { getPathForFile: (file: unknown) => dropped.get(file) ?? '' },
  contextBridge: { exposeInMainWorld: (key: string, api: unknown) => exposed.push([key, api]) },
  ipcRenderer: {
    invoke: async (...a: unknown[]) => (invoked.push(a), 'ok'),
    on: (ch: string, fn: Function) => void listeners.set(ch, fn),
    removeListener: (ch: string, fn: Function) => void (listeners.get(ch) === fn && listeners.delete(ch)),
  },
}));

beforeEach(async () => {
  exposed.length = 0;
  invoked.length = 0;
  listeners.clear();
  vi.resetModules();
  await import('../src/preload/index.ts');
});

describe('preload API', () => {
  it('exposes exactly one object under window.balance: the contract methods + five subscriptions, all functions, frozen', () => {
    expect(exposed).toHaveLength(1);
    const [key, api] = exposed[0]!;
    expect(key).toBe(API_KEY);
    expect(Object.keys(api).sort()).toEqual([...METHODS, 'onDbState', 'onLock', 'onOpenSettings', 'onProgress', 'onUpdate'].sort());
    expect(Object.values(api).every((v) => typeof v === 'function')).toBe(true);
    expect(Object.isFrozen(api)).toBe(true);
  });

  it('a method only forwards to its own channel', async () => {
    const api = exposed[0]![1];
    await api.startImport('2026-01-01');
    await api.setConnectionToken(1, 't'.repeat(30), true);
    expect(invoked).toEqual([
      ['balance:startImport', '2026-01-01'],
      ['balance:setConnectionToken', 1, 't'.repeat(30), true],
    ]);
  });

  it('openDroppedStatement takes a File and sends main its path; a File made by script sends an empty one', async () => {
    const api = exposed[0]![1];
    const file = { name: 'Вигадана.xlsx' };
    dropped.set(file, '/Users/someone/Вигадана.xlsx');
    await api.openDroppedStatement(file);
    await api.openDroppedStatement({ name: 'made-by-script.csv' });
    expect(invoked).toEqual([
      ['balance:openDroppedStatement', '/Users/someone/Вигадана.xlsx'],
      ['balance:openDroppedStatement', ''],
    ]);
  });

  it('openDroppedUpload takes Files and sends main their paths only', async () => {
    const api = exposed[0]![1];
    const a = { name: 'Вигадана-1.xlsx' };
    const b = { name: 'Вигадана-2.csv' };
    dropped.set(a, '/Users/someone/Вигадана-1.xlsx');
    dropped.set(b, '/Users/someone/Вигадана-2.csv');
    await api.openDroppedUpload([a, b]);
    await api.openDroppedUpload('not a list');
    expect(invoked).toEqual([
      ['balance:openDroppedUpload', ['/Users/someone/Вигадана-1.xlsx', '/Users/someone/Вигадана-2.csv']],
      ['balance:openDroppedUpload', []],
    ]);
  });

  it('onProgress gives the callback the payload only (never the IPC event with `sender`), and unsubscribes', () => {
    const api = exposed[0]![1];
    const got: unknown[][] = [];
    const off = api.onProgress((...a: unknown[]) => got.push(a));
    listeners.get(PROGRESS_CHANNEL)!({ sender: { secret: true } }, { account: 'black/UAH', remaining: 3 });
    expect(got).toEqual([[{ account: 'black/UAH', remaining: 3 }]]);
    off();
    expect(listeners.has(PROGRESS_CHANNEL)).toBe(false);
    expect(() => api.onProgress('not a function')).toThrow(TypeError);
  });

  it('onOpenSettings: its own channel, the callback gets nothing from the event, unsubscribes', () => {
    const api = exposed[0]![1];
    const got: unknown[][] = [];
    const off = api.onOpenSettings((...a: unknown[]) => got.push(a));
    listeners.get(OPEN_SETTINGS_CHANNEL)!({ sender: { secret: true } });
    expect(got).toEqual([[undefined]]);
    off();
    expect(listeners.has(OPEN_SETTINGS_CHANNEL)).toBe(false);
    expect(() => api.onOpenSettings(null)).toThrow(TypeError);
  });

  it('onLock: its own channel, the payload only, unsubscribes', () => {
    const api = exposed[0]![1];
    const got: unknown[][] = [];
    const off = api.onLock((...a: unknown[]) => got.push(a));
    listeners.get(LOCK_CHANNEL)!({ sender: { secret: true } }, { locked: true });
    expect(got).toEqual([[{ locked: true }]]);
    off();
    expect(listeners.has(LOCK_CHANNEL)).toBe(false);
  });

  it('onDbState: its own channel, the payload only, unsubscribes', () => {
    const api = exposed[0]![1];
    const got: unknown[][] = [];
    const off = api.onDbState((...a: unknown[]) => got.push(a));
    listeners.get(DB_STATE_CHANNEL)!({ sender: { secret: true } }, { status: 'key-lost' });
    expect(got).toEqual([[{ status: 'key-lost' }]]);
    off();
    expect(listeners.has(DB_STATE_CHANNEL)).toBe(false);
  });

  it('the preload source imports only the Electron module and the channel list (bundles into one CJS file)', () => {
    const code = fs.readFileSync(new URL('../src/preload/index.ts', import.meta.url), 'utf8');
    const imports = [...code.matchAll(/from '([^']+)'/g)].map((m) => m[1]);
    expect(imports).toEqual(['electron', '../shared/channels.ts']);
    // ipcRenderer is used, never handed out.
    expect(code).not.toMatch(/exposeInMainWorld\([^)]*ipcRenderer/);
    expect(code).not.toMatch(/api\.\w+\s*=\s*ipcRenderer\b/);
  });
});
