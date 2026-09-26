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

const { resultText, waitText } = await import('@/features/app-lock/utils.ts');

describe('texts', () => {
  it('waitText: seconds under a minute, minutes above, empty when over', () => {
    expect(waitText(null, 0)).toBe('');
    expect(waitText(1_000, 5_000)).toBe('');
    expect(waitText(25_000, 0)).toBe('Следующая попытка через 25 с');
    expect(waitText(61_000, 0)).toBe('Следующая попытка через 2 мин');
  });

  it('resultText: one line per reason, empty for ok', () => {
    expect(resultText({ ok: true })).toBe('');
    expect(resultText({ ok: false, reason: 'wrong-pin', retryAt: null })).toBe('Неверный PIN.');
    expect(resultText({ ok: false, reason: 'wait', retryAt: 1 })).toContain('попыток');
    expect(resultText({ ok: false, reason: 'cancelled' })).toContain('Touch ID');
    expect(resultText({ ok: false, reason: 'unavailable' })).toContain('недоступен');
  });
});

const { HINT_KEY } = await import('@/features/app-lock/constants.ts');
const { shouldShowHint } = await import('@/features/app-lock/utils.ts');

describe('lock hint', () => {
  it('shown only while the lock is off and the hint was not dismissed', () => {
    expect(shouldShowHint(null, false)).toBe(false); // view not loaded yet
    expect(shouldShowHint(view(false), false)).toBe(false); // enabled
    expect(shouldShowHint({ ...view(false), enabled: false }, false)).toBe(true);
    expect(shouldShowHint({ ...view(false), enabled: false }, true)).toBe(false);
  });

  it('the key is namespaced like the participant switch', () => {
    expect(HINT_KEY).toBe('balance.lock-hint');
  });
});

const { canForgetPin, normalizePin, shouldAutoPromptTouchId } = await import('@/features/app-lock/utils.ts');

describe('pin normalization and forget visibility', () => {
  it('normalizePin: strips non-digits, cuts to PIN_MAX', () => {
    expect(normalizePin('1234-5678')).toBe('12345678');
    expect(normalizePin('12a34')).toBe('1234');
  });

  it('canForgetPin: at FREE_ATTEMPTS or when broken', () => {
    expect(canForgetPin(5, false)).toBe(true);
    expect(canForgetPin(4, false)).toBe(false);
    expect(canForgetPin(0, true)).toBe(true);
  });

  it('shouldAutoPromptTouchId: only once, only with Touch ID on, only in a focused window', () => {
    const base = { touchId: true, broken: false, busy: false, prompted: false, focused: true };
    expect(shouldAutoPromptTouchId(base)).toBe(true);
    expect(shouldAutoPromptTouchId({ ...base, touchId: false })).toBe(false);
    expect(shouldAutoPromptTouchId({ ...base, broken: true })).toBe(false);
    expect(shouldAutoPromptTouchId({ ...base, busy: true })).toBe(false);
    expect(shouldAutoPromptTouchId({ ...base, prompted: true })).toBe(false);
    expect(shouldAutoPromptTouchId({ ...base, focused: false })).toBe(false);
  });
});
