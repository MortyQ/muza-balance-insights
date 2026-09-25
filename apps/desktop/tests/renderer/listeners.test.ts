// app/listeners.ts: while an import runs, every imported window refreshes the data (throttled); the end of an import
// refreshes it once more. balanceApi is a fake: no Electron, no preload.
// Typechecked with the renderer (tsconfig.web.json): it loads renderer modules through their aliases.
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ImportProgress, WindowProgress } from '@contract/progress.ts';

const api = vi.hoisted(() => {
  const state: { progress: ((p: unknown) => void) | null } = { progress: null };
  const fake = {
    getSyncStatus: vi.fn(async () => ({ hasData: true, dataUntil: null })),
    getUpdate: vi.fn(async () => ({})),
    hasToken: vi.fn(async () => ({ stored: null })),
    onProgress: vi.fn((cb: (p: unknown) => void) => ((state.progress = cb), () => undefined)),
    onUpdate: vi.fn(() => () => undefined),
    onOpenSettings: vi.fn(() => () => undefined),
  };
  return { state, fake };
});
vi.mock('@/shared/api', () => ({ balanceApi: api.fake }));

const { LIVE_REFRESH_MS, listenToMain } = await import('@/app/listeners.ts');

const win = (windowsDone: number): WindowProgress => ({
  phase: 'windows', account: 'black/UAH', from: '2026-08-01', to: '2026-09-01', round: 1, index: 1, total: 3,
  windowsDone, windowsTotal: 3, transactions: 0, etaSec: 0, waitingSec: null,
});
const send = (p: ImportProgress) => api.state.progress?.(p);
const refreshes = () => api.fake.getSyncStatus.mock.calls.length;

describe('listenToMain: live data during an import', () => {
  let off: () => void;
  beforeEach(() => {
    vi.useFakeTimers();
    setActivePinia(createPinia());
    api.fake.getSyncStatus.mockClear();
    off = listenToMain({ push: vi.fn() } as never);
  });
  afterEach(() => {
    off();
    vi.useRealTimers();
  });

  it('a new window refreshes; progress of the same window (waits, pages) does not', () => {
    send({ phase: 'starting', resumed: false });
    send(win(0)); // the first window started: nothing written yet
    expect(refreshes()).toBe(0);
    send(win(1));
    expect(refreshes()).toBe(1);
    send({ ...win(1), waitingSec: 40 });
    vi.advanceTimersByTime(LIVE_REFRESH_MS);
    expect(refreshes()).toBe(1);
  });

  it('windows faster than the throttle: one refresh now, the last one after the pause, none lost', () => {
    send(win(1));
    send(win(2));
    send(win(3));
    expect(refreshes()).toBe(1);
    vi.advanceTimersByTime(LIVE_REFRESH_MS);
    expect(refreshes()).toBe(2);
  });

  it('the end of an import refreshes once and drops a pending live refresh', () => {
    send(win(1));
    send(win(2)); // pending
    send({ phase: 'done', windowsTotal: 2, transactions: 10 });
    expect(refreshes()).toBe(2);
    vi.advanceTimersByTime(LIVE_REFRESH_MS * 2);
    expect(refreshes()).toBe(2);
  });

  it('a restarted worker counting from 0 again still refreshes on its windows', () => {
    send(win(2));
    vi.advanceTimersByTime(LIVE_REFRESH_MS);
    send({ phase: 'retry', reason: 'crash', attempt: 1, inSec: 60 });
    send(win(0));
    send(win(1));
    expect(refreshes()).toBe(2);
  });
});
