import type { Clock } from '@mono/core/shared/platform';

export const systemClock: Clock = {
  nowMs: () => Date.now(),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};
