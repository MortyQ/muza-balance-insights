// Cooperative cancellation of an import (desktop «Остановить»). The core checks the signal at safe points only:
// before a window, before a page, after a rate-limit wait. A window that has been fully fetched is still committed
// (atomically), so a cancel never loses downloaded data and never leaves a hole in the covered range.

export class SyncCancelledError extends Error {
  override name = 'SyncCancelledError';
  constructor() {
    super('Импорт остановлен');
  }
}

/** Sleeps via the injected clock; a cancel ends it as SyncCancelledError, whatever the clock rejects with. */
export async function cancellableSleep(clock: { sleep(ms: number, signal?: AbortSignal): Promise<void> }, ms: number, signal: AbortSignal | undefined): Promise<void> {
  try {
    await clock.sleep(ms, signal);
  } catch (err) {
    throwIfCancelled(signal);
    throw err;
  }
  throwIfCancelled(signal);
}

export function throwIfCancelled(signal: AbortSignal | undefined): void {
  if (signal?.aborted) throw new SyncCancelledError();
}
