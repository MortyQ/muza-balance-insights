// The lock in the renderer: the guard sends every route to the lock screen while locked (and away from it when open),
// the onLock push moves the router. balanceApi is a fake.
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LockView } from '@contract/lock.ts';

const view = (locked: boolean): LockView => ({
  enabled: true, locked, broken: false, touchIdAvailable: false, touchId: false,
  triggers: { startup: true, idle: true, screenLock: true, sleep: true }, failedAttempts: 0, retryAt: null, importRunning: false,
});

const api = vi.hoisted(() => ({
  state: { locked: true, onLock: null as ((v: unknown) => void) | null },
  fake: {} as Record<string, unknown>,
}));
api.fake = {
  getLockState: vi.fn(async () => view(api.state.locked)),
  listPeople: vi.fn(async () => ({ people: [{ id: 1, label: 'Я', labelFromBank: false, connections: [{}] }], secureStorage: true })),
  getSyncStatus: vi.fn(async () => ({ hasData: true, dataUntil: null, lastSyncAt: null })),
  getUpdate: vi.fn(async () => ({})),
  onProgress: vi.fn(() => () => undefined),
  onUpdate: vi.fn(() => () => undefined),
  onOpenSettings: vi.fn(() => () => undefined),
  onLock: vi.fn((cb: (v: unknown) => void) => ((api.state.onLock = cb), () => undefined)),
};
vi.mock('@/shared/api', () => ({ balanceApi: api.fake }));

const { startGuard } = await import('@/app/router/guards.ts');
const { listenToMain } = await import('@/app/listeners.ts');
const guard = (name: string) => (startGuard as (to: unknown, from: unknown) => unknown)({ name }, {});

beforeEach(() => setActivePinia(createPinia()));

describe('startGuard with the lock', () => {
  it('locked: every route → lock; lock itself stays', async () => {
    api.state.locked = true;
    for (const name of ['home', 'settings', 'connect']) expect(await guard(name)).toEqual({ name: 'lock' });
    expect(await guard('lock')).toBe(true);
  });

  it('open: the lock route → home; the rest as before', async () => {
    api.state.locked = false;
    expect(await guard('lock')).toEqual({ name: 'home' });
    expect(await guard('settings')).toBe(true);
    expect(await guard('home')).toBe(true);
  });
});

describe('onLock push', () => {
  it('locks → replace(lock); opens on the lock screen → replace(home)', () => {
    const router = { push: vi.fn(), replace: vi.fn(async () => undefined), currentRoute: { value: { name: 'home' } } };
    const off = listenToMain(router as never);
    api.state.onLock!(view(true));
    expect(router.replace).toHaveBeenLastCalledWith({ name: 'lock' });
    router.currentRoute.value.name = 'lock';
    api.state.onLock!(view(false));
    expect(router.replace).toHaveBeenLastCalledWith({ name: 'home' });
    off();
  });
});
