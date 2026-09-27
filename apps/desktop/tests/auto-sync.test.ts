// «Автосинхронизация»: when a refresh starts (switches, a ready database, data already there, the gap since the latest
// sync or attempt), and the wake / periodic triggers. Plus how main wires it.
import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { AutoSync, CHECK_EVERY_MS, INTERVAL_MS, MIN_GAP_MS, WAKE_DELAY_MS, watchAutoSync, type AutoSyncDeps } from '../src/main/auto-sync.ts';
import { AUTO_SYNC_TRIGGERS, DEFAULT_AUTO_SYNC, type AutoSyncSettings } from '../src/shared/auto-sync.ts';
import type { StartImportResult } from '../src/shared/progress.ts';

const NOW = 1_800_000_000_000;
const MIN = 60_000;

function setup(o: { settings?: AutoSyncSettings; ready?: boolean; last?: number | null; result?: StartImportResult } = {}) {
  const clock = { now: NOW };
  const state = { settings: o.settings ?? DEFAULT_AUTO_SYNC, ready: o.ready ?? true, last: o.last === undefined ? (NOW - 5 * 3600_000) / 1000 : o.last };
  const starts: number[] = [];
  const logs: string[] = [];
  const deps: AutoSyncDeps = {
    settings: () => state.settings,
    ready: () => state.ready,
    lastSyncSec: async () => state.last,
    start: async () => (starts.push(clock.now), o.result ?? { started: true }),
    nowMs: () => clock.now,
    log: (m) => logs.push(m),
  };
  return { auto: new AutoSync(deps), clock, state, starts, logs };
}

describe('AutoSync.maybeRun', () => {
  it('every trigger starts a refresh when the latest sync is older than its gap; the result is logged', async () => {
    for (const t of AUTO_SYNC_TRIGGERS) {
      const s = setup();
      expect(await s.auto.maybeRun(t)).toBe(true);
      expect(s.starts).toEqual([NOW]);
      expect(s.logs).toEqual([`auto-sync: ${t} → started`]);
    }
  });

  it('the main switch off → no trigger starts; a trigger switched off → only that one does not', async () => {
    const off = setup({ settings: { ...DEFAULT_AUTO_SYNC, enabled: false } });
    for (const t of AUTO_SYNC_TRIGGERS) expect(await off.auto.maybeRun(t)).toBe(false);
    expect(off.starts).toEqual([]);

    for (const t of AUTO_SYNC_TRIGGERS) {
      const s = setup({ settings: { enabled: true, triggers: { ...DEFAULT_AUTO_SYNC.triggers, [t]: false } } });
      expect(await s.auto.maybeRun(t)).toBe(false);
      for (const other of AUTO_SYNC_TRIGGERS.filter((x) => x !== t)) expect(await setup({ settings: s.state.settings }).auto.maybeRun(other)).toBe(true);
    }
  });

  it('database not ready, or nothing ever imported → nothing starts', async () => {
    const a = setup({ ready: false });
    const b = setup({ last: null });
    for (const t of AUTO_SYNC_TRIGGERS) {
      expect(await a.auto.maybeRun(t)).toBe(false);
      expect(await b.auto.maybeRun(t)).toBe(false);
    }
    expect([...a.starts, ...b.starts]).toEqual([]);
  });

  it('launch and wake: not within 30 min of the latest sync; the periodic check: not within 4 h', async () => {
    const recent = (NOW - MIN_GAP_MS + MIN) / 1000;
    expect(await setup({ last: recent }).auto.maybeRun('launch')).toBe(false);
    expect(await setup({ last: recent }).auto.maybeRun('wake')).toBe(false);
    expect(await setup({ last: (NOW - MIN_GAP_MS) / 1000 }).auto.maybeRun('launch')).toBe(true);
    expect(await setup({ last: (NOW - INTERVAL_MS + MIN) / 1000 }).auto.maybeRun('interval')).toBe(false);
    expect(await setup({ last: (NOW - INTERVAL_MS) / 1000 }).auto.maybeRun('interval')).toBe(true);
  });

  it('an attempt counts like a sync: one that did not start (a token missing …) is not retried at once', async () => {
    const s = setup({ result: { started: false, reason: 'no-token' } });
    expect(await s.auto.maybeRun('launch')).toBe(false);
    expect(s.logs).toEqual(['auto-sync: launch → no-token']);
    expect(await s.auto.maybeRun('wake')).toBe(false);
    s.clock.now += MIN_GAP_MS;
    expect(await s.auto.maybeRun('wake')).toBe(false);
    expect(s.starts).toHaveLength(2);
    s.clock.now += INTERVAL_MS;
    await s.auto.maybeRun('interval');
    expect(s.starts).toHaveLength(3);
  });

  it('the switches are read at every trigger: a change applies without a restart', async () => {
    const s = setup({ settings: { ...DEFAULT_AUTO_SYNC, enabled: false } });
    expect(await s.auto.maybeRun('launch')).toBe(false);
    s.state.settings = DEFAULT_AUTO_SYNC;
    expect(await s.auto.maybeRun('launch')).toBe(true);
  });
});

describe('watchAutoSync', () => {
  function fakeTimers() {
    const afters: Array<{ fn: () => void; ms: number; cancelled: boolean }> = [];
    const everys: Array<{ fn: () => void; ms: number; stopped: boolean }> = [];
    return {
      afters,
      everys,
      timers: {
        after: (fn: () => void, ms: number) => {
          const t = { fn, ms, cancelled: false };
          afters.push(t);
          return () => void (t.cancelled = true);
        },
        every: (fn: () => void, ms: number) => {
          const t = { fn, ms, stopped: false };
          everys.push(t);
          return () => void (t.stopped = true);
        },
      },
    };
  }
  const tick = () => new Promise((r) => setTimeout(r, 0));

  it('wake: a refresh a minute after resume; a second resume in that minute replaces the pending one', async () => {
    const s = setup();
    const f = fakeTimers();
    let resume: () => void = () => undefined;
    watchAutoSync(s.auto, (l) => void (resume = l), f.timers);
    resume();
    resume();
    expect(f.afters.map((a) => [a.ms, a.cancelled])).toEqual([
      [WAKE_DELAY_MS, true],
      [WAKE_DELAY_MS, false],
    ]);
    expect(s.starts).toEqual([]);
    f.afters[1]!.fn();
    await tick();
    expect(s.logs).toEqual(['auto-sync: wake → started']);
  });

  it('the periodic check every 30 min uses the interval trigger; stop cancels both', async () => {
    const s = setup();
    const f = fakeTimers();
    let resume: () => void = () => undefined;
    const stop = watchAutoSync(s.auto, (l) => void (resume = l), f.timers);
    expect(f.everys.map((e) => e.ms)).toEqual([CHECK_EVERY_MS]);
    f.everys[0]!.fn();
    await tick();
    expect(s.logs).toEqual(['auto-sync: interval → started']);
    resume();
    stop();
    expect(f.everys[0]!.stopped).toBe(true);
    expect(f.afters[0]!.cancelled).toBe(true);
  });
});

describe('wiring in main', () => {
  const strip = (p: string) => fs.readFileSync(new URL(p, import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');

  it('auto-sync.ts has no Electron; main starts the launch trigger after resume on launch, wake on powerMonitor resume', () => {
    expect(strip('../src/main/auto-sync.ts')).not.toMatch(/from 'electron'/);
    const code = strip('../src/main/index.ts');
    expect(code).toMatch(/importer\.resumeOnLaunch\(\)\.then\(\(\) => autoSync\.maybeRun\('launch'\)\)/);
    expect(code).toMatch(/watchAutoSync\(autoSync, \(l\) => void powerMonitor\.on\('resume', l\)/);
    expect(code).toMatch(/start: \(\) => importer\.startAuto\(\)/);
    expect(code).toMatch(/settings: \(\) => readPrefs\(userData\)\.autoSync/);
    expect(code).toMatch(/ready: \(\) => access\.isReady\(\)/);
  });
});
