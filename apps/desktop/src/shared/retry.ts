// Retry policy for a long (overnight) import, shared by the worker (network / Monobank failures) and main (a crashed
// worker): the first retry after a minute (a short blip), then every 15 minutes, for up to 4 hours of failures in a row.
// A window that succeeds resets the streak. Plain module: no dependencies.

export const RETRY_FIRST_MS = 60_000;
export const RETRY_EVERY_MS = 15 * 60_000;
export const RETRY_BUDGET_MS = 4 * 3600_000;

/**
 * Delay before retry number `attempt` (1-based) of a streak that began failing at `failingSinceMs`,
 * or null when the retry would land past the budget (give up, keep the job for the next launch).
 */
export function nextRetryDelay(failingSinceMs: number, nowMs: number, attempt: number): number | null {
  const delay = attempt <= 1 ? RETRY_FIRST_MS : RETRY_EVERY_MS;
  return nowMs + delay - failingSinceMs > RETRY_BUDGET_MS ? null : delay;
}

/**
 * Timers do not run while the computer sleeps, so a retry pause that ends much later than planned means the Mac was
 * asleep. That time is not a failure: the caller shifts the streak start forward by the returned amount, so the
 * 4-hour budget counts only awake time. Short overruns (a busy event loop) are ignored.
 */
export const SLEEP_TOLERANCE_MS = 30_000;

export function sleptDuringPause(pauseStartMs: number, pauseEndMs: number, plannedMs: number): number {
  const extra = pauseEndMs - pauseStartMs - plannedMs;
  return extra > SLEEP_TOLERANCE_MS ? extra : 0;
}
