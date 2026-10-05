// The database state in the renderer: the guard (lock first, then the recovery screen for any route), the onDbState
// push, the texts per status and the buttons. balanceApi is a fake.
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DbStateView } from '@contract/db-state.ts';

const db = (status: DbStateView['status'], platform: DbStateView['platform'] = 'darwin'): DbStateView => ({
  status, encrypted: status === 'ready', notice: null, platform,
});

const api = vi.hoisted(() => ({
  state: { locked: false, db: null as unknown, onDbState: null as ((v: unknown) => void) | null, hasConnections: true },
  fake: {} as Record<string, unknown>,
}));
api.fake = {
  getLockState: vi.fn(async () => ({ locked: api.state.locked })),
  getDbState: vi.fn(async () => api.state.db),
  listPeople: vi.fn(async () => ({ people: api.state.hasConnections ? [{ id: 1, label: 'Я', labelFromBank: false, connections: [{}] }] : [], secureStorage: true })),
  getSyncStatus: vi.fn(async () => ({ hasData: false, dataUntil: null, lastSyncAt: null })),
  getUpdate: vi.fn(async () => ({})),
  relaunchApp: vi.fn(async () => undefined),
  startOver: vi.fn(async () => ({ done: false, reason: 'cancelled' })),
  deleteAllData: vi.fn(async () => ({ deleted: false })),
  quitApp: vi.fn(async () => undefined),
  onProgress: vi.fn(() => () => undefined),
  onUpdate: vi.fn(() => () => undefined),
  onOpenSettings: vi.fn(() => () => undefined),
  onLock: vi.fn(() => () => undefined),
  onDbState: vi.fn((cb: (v: unknown) => void) => ((api.state.onDbState = cb), () => undefined)),
};
vi.mock('@/shared/api', () => ({ balanceApi: api.fake }));

const { startGuard } = await import('@/app/router/guards.ts');
const { listenToMain } = await import('@/app/listeners.ts');
const { recoveryText } = await import('@/features/settings/db-recovery/utils.ts');
const { useDbRecovery } = await import('@/features/settings/db-recovery/composables/useDbRecovery.ts');
const { useDbStateStore } = await import('@/entities/db-state');
const { routes } = await import('@/app/router/routes.ts');
// The route's real meta: the guard reads its layout.
const guard = (name: string) =>
  (startGuard as (to: unknown, from: unknown) => unknown)({ name, meta: routes.find((r) => r.name === name)?.meta ?? {} }, {});

beforeEach(() => {
  setActivePinia(createPinia());
  api.state.locked = false;
  api.state.hasConnections = true;
  vi.clearAllMocks();
});

describe('startGuard with the database', () => {
  it.each(['key-unavailable', 'key-lost', 'db-unreadable'] as const)('%s: every route, settings too → db-recovery; it stays', async (status) => {
    api.state.db = db(status);
    for (const name of ['home', 'settings', 'connect']) expect(await guard(name)).toEqual({ name: 'db-recovery' });
    expect(await guard('db-recovery')).toBe(true);
  });

  it('the lock comes first: locked + not ready → lock, and the database state is not even asked', async () => {
    api.state.locked = true;
    api.state.db = db('key-lost');
    expect(await guard('home')).toEqual({ name: 'lock' });
    expect(await guard('db-recovery')).toEqual({ name: 'lock' });
    expect(api.fake.getDbState).not.toHaveBeenCalled();
  });

  it('ready: db-recovery → home; the rest as before', async () => {
    api.state.db = db('ready');
    expect(await guard('db-recovery')).toEqual({ name: 'home' });
    expect(await guard('settings')).toBe(true);
    expect(await guard('home')).toBe(true);
  });

  it('every data screen (the default layout) is open with home; with nothing to show they go to connect', async () => {
    api.state.db = db('ready');
    expect(await guard('analytics')).toBe(true);
    expect(await guard('connect')).toEqual({ name: 'home' });
    api.state.hasConnections = false;
    setActivePinia(createPinia());
    expect(await guard('analytics')).toEqual({ name: 'connect' });
  });

  it('main did not answer getDbState: no recovery screen (main still refuses data)', async () => {
    (api.fake.getDbState as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('x'));
    expect(await guard('settings')).toBe(true);
  });
});

describe('onDbState push', () => {
  const router = () => ({ push: vi.fn(), replace: vi.fn(async () => undefined), currentRoute: { value: { name: 'home' as string } } });

  it('not ready → replace(db-recovery); ready again on it → people and data refetched, then home', async () => {
    const r = router();
    const off = listenToMain(r as never);
    api.state.onDbState!(db('key-lost'));
    expect(r.replace).toHaveBeenLastCalledWith({ name: 'db-recovery' });
    r.currentRoute.value.name = 'db-recovery';
    api.state.onDbState!(db('ready'));
    await vi.waitFor(() => expect(r.replace).toHaveBeenLastCalledWith({ name: 'home' }));
    expect(api.fake.listPeople).toHaveBeenCalled();
    expect(api.fake.getSyncStatus).toHaveBeenCalled();
    off();
  });

  it('never over the lock screen', () => {
    const r = router();
    r.currentRoute.value.name = 'lock';
    const off = listenToMain(r as never);
    api.state.onDbState!(db('key-lost'));
    expect(r.replace).not.toHaveBeenCalled();
    expect(useDbStateStore().ready).toBe(false);
    off();
  });
});

describe('recovery texts', () => {
  it('ready or unknown → none', () => {
    expect(recoveryText(null)).toBeNull();
    expect(recoveryText(db('ready'))).toBeNull();
  });

  it('key-unavailable: per platform, «Перезапустить» first, no advice to «Всегда разрешать»', () => {
    const mac = recoveryText(db('key-unavailable', 'darwin'))!;
    expect(mac).toMatchObject({ title: 'Нет доступа к ключу базы', primary: 'relaunch' });
    expect(mac.detail).toContain('Связки ключей');
    expect(recoveryText(db('key-unavailable', 'linux'))!.detail).toContain('keyring');
    expect(recoveryText(db('key-unavailable', 'win32'))!.detail).toContain('не ответило');
    for (const p of ['darwin', 'linux', 'win32', 'other'] as const) expect(recoveryText(db('key-unavailable', p))!.detail).not.toContain('Всегда');
  });

  it('key-lost and db-unreadable: «Начать заново» first', () => {
    expect(recoveryText(db('key-lost'))).toMatchObject({ title: 'Ключ базы потерян', primary: 'startOver' });
    expect(recoveryText(db('db-unreadable'))).toMatchObject({ title: 'База не открывается', primary: 'startOver' });
  });
});

describe('useDbRecovery', () => {
  it('each button calls its own method; a failure gives a fixed text; one at a time', async () => {
    const { run, error, busy } = useDbRecovery();
    await run('relaunch');
    await run('startOver');
    await run('delete');
    await run('quit');
    expect(api.fake.relaunchApp).toHaveBeenCalledTimes(1);
    expect(api.fake.startOver).toHaveBeenCalledTimes(1);
    expect(api.fake.deleteAllData).toHaveBeenCalledTimes(1);
    expect(api.fake.quitApp).toHaveBeenCalledTimes(1);
    (api.fake.startOver as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('secret'));
    await run('startOver');
    expect(error.value).toContain('Не получилось');
    expect(error.value).not.toContain('secret');
    expect(busy.value).toBeNull();
  });
});
