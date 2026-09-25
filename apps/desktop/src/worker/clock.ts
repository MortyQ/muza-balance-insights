import type { Clock } from '@mono/core/platform';

/** Wall clock whose sleep ends early (rejects) when the signal aborts — «Остановить» doesn't wait out the 60 s limit. */
export const abortableClock: Clock = {
  nowMs: () => Date.now(),
  sleep: (ms, signal) =>
    new Promise<void>((resolve, reject) => {
      if (signal?.aborted) return reject(new Error('aborted'));
      const timer = setTimeout(() => {
        signal?.removeEventListener('abort', onAbort);
        resolve();
      }, ms);
      const onAbort = () => {
        clearTimeout(timer);
        reject(new Error('aborted'));
      };
      signal?.addEventListener('abort', onAbort, { once: true });
    }),
};
