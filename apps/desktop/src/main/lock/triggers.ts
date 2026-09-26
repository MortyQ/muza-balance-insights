// The automatic lock triggers, without Electron: the screen lock, sleep, and the system idle time checked once a minute.
import { IDLE_LOCK_SEC, type LockTrigger } from '../../shared/lock.ts';

export const IDLE_CHECK_MS = 60_000;

export type PowerMonitorLike = {
  onScreenLock(listener: () => void): void;
  onSuspend(listener: () => void): void;
  /** Seconds since the last input anywhere in the system (not only in our window). */
  idleSeconds(): number;
};

/** Returns the function that stops the idle check (the power events live as long as the app). */
export function watchLockTriggers(
  pm: PowerMonitorLike,
  fire: (trigger: LockTrigger) => void,
  every: (fn: () => void, ms: number) => () => void,
): () => void {
  pm.onScreenLock(() => fire('screenLock'));
  pm.onSuspend(() => fire('sleep'));
  return every(() => {
    if (pm.idleSeconds() >= IDLE_LOCK_SEC) fire('idle');
  }, IDLE_CHECK_MS);
}
