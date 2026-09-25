// The preload with a fake Electron module: what exactly reaches window.balance (Checklist #20).
import fs from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { API_KEY, METHODS, OPEN_SETTINGS_CHANNEL, PROGRESS_CHANNEL } from '../src/shared/channels.ts';

const exposed: Array<[string, any]> = [];
const invoked: unknown[][] = [];
const listeners = new Map<string, Function>();

vi.mock('electron', () => ({
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
  it('exposes exactly one object under window.balance: the contract methods + three subscriptions, all functions, frozen', () => {
    expect(exposed).toHaveLength(1);
    const [key, api] = exposed[0]!;
    expect(key).toBe(API_KEY);
    expect(Object.keys(api).sort()).toEqual([...METHODS, 'onOpenSettings', 'onProgress', 'onUpdate'].sort());
    expect(Object.values(api).every((v) => typeof v === 'function')).toBe(true);
    expect(Object.isFrozen(api)).toBe(true);
  });

  it('a method only forwards to its own channel', async () => {
    const api = exposed[0]![1];
    await api.startImport(3);
    await api.setToken('t'.repeat(30), true);
    expect(invoked).toEqual([
      ['balance:startImport', 3],
      ['balance:setToken', 't'.repeat(30), true],
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

  it('the preload source imports only the Electron module and the channel list (bundles into one CJS file)', () => {
    const code = fs.readFileSync(new URL('../src/preload/index.ts', import.meta.url), 'utf8');
    const imports = [...code.matchAll(/from '([^']+)'/g)].map((m) => m[1]);
    expect(imports).toEqual(['electron', '../shared/channels.ts']);
    // ipcRenderer is used, never handed out.
    expect(code).not.toMatch(/exposeInMainWorld\([^)]*ipcRenderer/);
    expect(code).not.toMatch(/api\.\w+\s*=\s*ipcRenderer\b/);
  });
});
