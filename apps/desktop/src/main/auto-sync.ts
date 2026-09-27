// «Автосинхронизация» without Electron: when an automatic refresh starts. Three triggers — app launch, wake from sleep
// (after a pause: the network is often not back yet), a periodic check — each behind the user's switches. A refresh
// needs data already there (the first history is the user's choice) and a gap since the latest sync, so frequent
// relaunches do not eat the bank's rate limit. The run itself is Importer.startAuto.
import type { AutoSyncSettings, AutoSyncTrigger } from '../shared/auto-sync.ts';
import type { StartImportResult } from '../shared/progress.ts';

/** Launch and wake: no refresh sooner than this after the latest sync or attempt. */
export const MIN_GAP_MS = 30 * 60_000;
/** The periodic check: a refresh once this much has passed. */
export const INTERVAL_MS = 4 * 3600_000;
export const CHECK_EVERY_MS = 30 * 60_000;
export const WAKE_DELAY_MS = 60_000;

export type AutoSyncDeps = {
  settings: () => AutoSyncSettings;
  /** The database can be used (DbAccess ready). */
  ready: () => boolean;
  /** Epoch seconds of the latest sync of any account; null — nothing was ever imported. */
  lastSyncSec: () => Promise<number | null>;
  start: () => Promise<StartImportResult>;
  nowMs: () => number;
  log: (msg: string) => void;
};

export class AutoSync {
  private lastAttemptMs: number | null = null;

  constructor(private readonly d: AutoSyncDeps) {}

  /** Starts a refresh if `trigger` allows one now; true when it started. */
  async maybeRun(trigger: AutoSyncTrigger): Promise<boolean> {
    const s = this.d.settings();
    if (!s.enabled || !s.triggers[trigger] || !this.d.ready()) return false;
    const last = await this.d.lastSyncSec();
    if (last === null) return false;
    const now = this.d.nowMs();
    const since = Math.max(last * 1000, this.lastAttemptMs ?? -Infinity);
    if (now - since < (trigger === 'interval' ? INTERVAL_MS : MIN_GAP_MS)) return false;
    this.lastAttemptMs = now;
    const r = await this.d.start();
    this.d.log(`auto-sync: ${trigger} → ${r.started ? 'started' : r.reason}`);
    return r.started;
  }
}

export type AutoSyncTimers = {
  after: (fn: () => void, ms: number) => () => void;
  every: (fn: () => void, ms: number) => () => void;
};

/** Wake and periodic triggers; returns the function that stops them. The launch trigger is the caller's (first load). */
export function watchAutoSync(auto: AutoSync, onResume: (listener: () => void) => void, timers: AutoSyncTimers): () => void {
  let cancelWake: (() => void) | null = null;
  const run = (t: AutoSyncTrigger) => void auto.maybeRun(t).catch(() => undefined);
  onResume(() => {
    cancelWake?.();
    cancelWake = timers.after(() => {
      cancelWake = null;
      run('wake');
    }, WAKE_DELAY_MS);
  });
  const stopEvery = timers.every(() => run('interval'), CHECK_EVERY_MS);
  return () => {
    cancelWake?.();
    stopEvery();
  };
}
