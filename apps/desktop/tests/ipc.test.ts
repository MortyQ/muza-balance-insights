import { describe, expect, it } from 'vitest';
import { ARG_SCHEMAS, FAILED, FORBIDDEN, INVALID_ARGS, frameOrigin, isTrustedSender, registerIpc, type IpcEventLike } from '../src/main/ipc.ts';
import { CHANNEL_PREFIX, METHODS, channel } from '../src/shared/channels.ts';
import { IMPORT_DEPTHS } from '../src/shared/progress.ts';

const WC = { id: 1 };
const WIN = { webContents: WC };
const mainFrame = (url: string) => ({ url, parent: null });
const good: IpcEventLike = { sender: WC, senderFrame: mainFrame('app://renderer/index.html') };

function fakeIpcMain() {
  const handlers = new Map<string, (e: IpcEventLike, ...a: unknown[]) => Promise<unknown>>();
  return { handle: (ch: string, fn: any) => void handlers.set(ch, fn), handlers };
}

describe('sender validation (Checklist #17)', () => {
  it('custom-scheme origin is computed by hand (URL.origin is "null" for app:)', () => {
    expect(new URL('app://renderer/index.html').origin).toBe('null');
    expect(frameOrigin('app://renderer/index.html')).toBe('app://renderer');
    expect(frameOrigin('about:blank')).toBeNull();
  });

  it.each([
    ['our main frame on app://', good, null, true],
    ['dev server main frame in dev', { sender: WC, senderFrame: mainFrame('http://localhost:5174/') }, 'http://localhost:5174', true],
    ['dev server origin when not in dev', { sender: WC, senderFrame: mainFrame('http://localhost:5174/') }, null, false],
    ['another webContents', { sender: { id: 2 }, senderFrame: mainFrame('app://renderer/') }, null, false],
    ['a subframe', { sender: WC, senderFrame: { url: 'app://renderer/x.html', parent: {} } }, null, false],
    ['no frame (destroyed)', { sender: WC, senderFrame: null }, null, false],
    ['foreign origin', { sender: WC, senderFrame: mainFrame('https://example.com/') }, null, false],
    ['lookalike host', { sender: WC, senderFrame: mainFrame('app://renderer.evil/') }, null, false],
    ['about:blank', { sender: WC, senderFrame: mainFrame('about:blank') }, null, false],
  ] as const)('%s → %s', (_, ev, dev, ok) => {
    expect(isTrustedSender(ev as IpcEventLike, WIN, dev)).toBe(ok);
  });

  it('no window → nobody is trusted', () => {
    expect(isTrustedSender(good, null, null)).toBe(false);
  });
});

describe('registerIpc (no generic channels, zod on every argument)', () => {
  const allHandlers = Object.fromEntries(METHODS.map((m) => [m, async (...a: unknown[]) => ({ m, a })])) as any;

  it('registers exactly the contract methods it is given, under balance:*', () => {
    const ipc = fakeIpcMain();
    const reg = registerIpc(ipc, allHandlers, { trusted: () => true });
    expect(reg).toEqual(METHODS.map(channel));
    expect([...ipc.handlers.keys()].every((k) => k.startsWith(CHANNEL_PREFIX))).toBe(true);
    // Unknown handler names are ignored — nothing outside the contract can be registered.
    const ipc2 = fakeIpcMain();
    expect(registerIpc(ipc2, { runSql: async () => 1, fetch: async () => 1 } as any, { trusted: () => true })).toEqual([]);
  });

  it('an untrusted sender is refused before argument parsing, the handler never runs', async () => {
    const ipc = fakeIpcMain();
    let ran = false;
    registerIpc(ipc, { listPeople: async () => ((ran = true), true) }, { trusted: () => false });
    await expect(ipc.handlers.get('balance:listPeople')!(good)).rejects.toThrow(FORBIDDEN);
    expect(ran).toBe(false);
  });

  const INVALID: Array<[string, unknown[]]> = [
    ['setConnectionToken', []],
    ['setConnectionToken', [1, 'x'.repeat(40), 'yes']],
    ['setConnectionToken', [1, 'has space in the token 123456', true]],
    ['setConnectionToken', [1, 'x'.repeat(201), true]],
    ['setConnectionToken', [1, 'x'.repeat(40), true, 'extra']],
    ['startImport', [2]],
    ['startImport', ['3']],
    ['startImport', []],
    ['startImport', [3, 'extra']],
    ['spendingSummary', [{ from: '2026-09-01' }]],
    ['spendingSummary', [{ from: '2026-9-1', to: '2026-09-30' }]],
    ['spendingSummary', [{ from: '2026-09-01', to: '2026-09-30', sql: 'DROP TABLE x' }]],
    ['spendingSummary', [{ from: '2026-09-01', to: '2026-09-30', scope: 'all' }]],
    ['getBalances', [1]],
    ['getBalances', [{ participantId: 0 }]],
    ['getBalances', [{ participantId: 1, sql: 'x' }]],
    ['getBalances', [{}, 'extra']],
    ['spendingSummary', [{ from: '2026-09-01', to: '2026-09-30', participantId: '1' }]],
    ['spendingSummary', [{ from: '2026-09-01', to: '2026-09-30', participantId: 1.5 }]],
    ['listPeople', [1]],
    ['addConnection', []],
    ['addConnection', [{ participant: { id: 1 }, provider: 'monobank', token: 'short', remember: true }]],
    ['addConnection', [{ participant: { id: 1 }, provider: 'otherbank', token: 'x'.repeat(40), remember: true }]],
    ['addConnection', [{ participant: { id: 0 }, provider: 'monobank', token: 'x'.repeat(40), remember: true }]],
    ['addConnection', [{ participant: { label: '' }, provider: 'monobank', token: 'x'.repeat(40), remember: true }]],
    ['addConnection', [{ participant: { fromBank: false }, provider: 'monobank', token: 'x'.repeat(40), remember: true }]],
    ['addConnection', [{ participant: { id: 1, label: 'x' }, provider: 'monobank', token: 'x'.repeat(40), remember: true }]],
    ['addConnection', [{ participant: { id: 1 }, provider: 'monobank', token: 'x'.repeat(40), remember: true, extra: 1 }]],
    ['renameParticipant', [1]],
    ['renameParticipant', [1, '']],
    ['renameParticipant', [1, 'x'.repeat(81)]],
    ['renameParticipant', ['1', 'Ім’я']],
    ['setConnectionToken', [1, 'short', true]],
    ['setConnectionToken', [-1, 'x'.repeat(40), true]],
    ['setConnectionToken', [1, 'x'.repeat(40)]],
    ['removeConnection', []],
    ['removeConnection', [1.5]],
    ['removeConnection', [1, true]],
    ['deleteAllData', [{ confirm: true }]],
    ['cancelImport', [1]],
    ['getSyncStatus', [{}]],
    ['getUpdate', [1]],
    ['checkForUpdates', ['now']],
    ['downloadUpdate', [{ url: 'https://evil.example/x.dmg' }]],
    ['installUpdate', [true]],
    ['setUpdateChecks', []],
    ['setUpdateChecks', ['yes']],
    ['setUpdateChecks', [true, 'extra']],
  ];
  it.each(INVALID)('%s(%j) → rejected, handler not called', async (m, args) => {
    const ipc = fakeIpcMain();
    let ran = false;
    registerIpc(ipc, { [m]: async () => ((ran = true), 1) } as any, { trusted: () => true });
    await expect(ipc.handlers.get(`balance:${m}`)!(good, ...args)).rejects.toThrow(INVALID_ARGS);
    expect(ran).toBe(false);
  });

  it('every method has at least one invalid case above', () => {
    const covered = new Set(INVALID.map(([m]) => m));
    for (const m of METHODS) expect(covered.has(m), m).toBe(true);
  });

  it('startImport accepts exactly the depths the screen offers (one list: IMPORT_DEPTHS)', () => {
    for (const d of IMPORT_DEPTHS) expect(ARG_SCHEMAS.startImport.safeParse([d]).success).toBe(true);
    for (const d of [0, 2, 6, 48, 1.5, -1]) expect(ARG_SCHEMAS.startImport.safeParse([d]).success).toBe(false);
  });

  it('valid calls reach the handler with parsed arguments', async () => {
    const ipc = fakeIpcMain();
    registerIpc(ipc, allHandlers, { trusted: () => true });
    await expect(ipc.handlers.get('balance:startImport')!(good, 12)).resolves.toEqual({ m: 'startImport', a: [12] });
    await expect(ipc.handlers.get('balance:spendingSummary')!(good, { from: '2026-09-01', to: '2026-09-30' })).resolves.toEqual({
      m: 'spendingSummary',
      a: [{ from: '2026-09-01', to: '2026-09-30' }],
    });
    await expect(ipc.handlers.get('balance:getBalances')!(good)).resolves.toEqual({ m: 'getBalances', a: [] });
    await expect(ipc.handlers.get('balance:getBalances')!(good, { participantId: 2 })).resolves.toEqual({ m: 'getBalances', a: [{ participantId: 2 }] });
    for (const participant of [{ id: 3 }, { label: 'Вигадана' }, { fromBank: true }]) {
      const input = { participant, provider: 'monobank', token: 'x'.repeat(40), remember: false };
      await expect(ipc.handlers.get('balance:addConnection')!(good, input)).resolves.toEqual({ m: 'addConnection', a: [input] });
    }
  });

  it('handler errors reach the renderer as a fixed message; details go to onError only', async () => {
    const ipc = fakeIpcMain();
    const seen: string[] = [];
    registerIpc(
      ipc,
      {
        getBalances: async () => {
          throw new Error('SECRET internal path /Users/x/db token=abc');
        },
      },
      { trusted: () => true, onError: (m, e) => seen.push(`${m}:${(e as Error).message}`) },
    );
    const err = await ipc.handlers.get('balance:getBalances')!(good).catch((e: Error) => e);
    expect((err as Error).message).toBe(FAILED);
    expect(JSON.stringify(err)).not.toContain('SECRET');
    expect(seen).toEqual(['getBalances:SECRET internal path /Users/x/db token=abc']);
  });

  it('schemas cover exactly the contract', () => {
    expect(Object.keys(ARG_SCHEMAS).sort()).toEqual([...METHODS].sort());
  });
});
