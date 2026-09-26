import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { IDLE_LOCK_SEC } from '../src/shared/lock.ts';
import { IDLE_CHECK_MS, watchLockTriggers, type PowerMonitorLike } from '../src/main/lock/triggers.ts';

function fakeMonitor() {
  const on: Record<'screen' | 'suspend', Array<() => void>> = { screen: [], suspend: [] };
  const state = { idle: 0 };
  const pm: PowerMonitorLike = {
    onScreenLock: (l) => void on.screen.push(l),
    onSuspend: (l) => void on.suspend.push(l),
    idleSeconds: () => state.idle,
  };
  return { pm, on, state };
}

describe('watchLockTriggers', () => {
  it('screen lock → screenLock, sleep → sleep, idle ≥ 60 min on the minute check → idle', () => {
    const { pm, on, state } = fakeMonitor();
    const fired: string[] = [];
    let tick: (() => void) | null = null;
    let every = 0;
    const stop = watchLockTriggers(pm, (t) => void fired.push(t), (fn, ms) => ((tick = fn), (every = ms), () => void (tick = null)));
    expect(every).toBe(IDLE_CHECK_MS);
    on.screen.forEach((l) => l());
    on.suspend.forEach((l) => l());
    state.idle = IDLE_LOCK_SEC - 1;
    tick!();
    state.idle = IDLE_LOCK_SEC;
    tick!();
    expect(fired).toEqual(['screenLock', 'sleep', 'idle']);
    stop();
    expect(tick).toBeNull();
  });

  it('electron.ts is the only file of the lock that imports electron', () => {
    for (const f of ['pin', 'attempts', 'store', 'service', 'triggers', 'gate']) {
      const code = fs.readFileSync(new URL(`../src/main/lock/${f}.ts`, import.meta.url), 'utf8');
      expect(code, f).not.toMatch(/from 'electron'/);
    }
  });
});
