// The pause ladder after wrong PINs. A guess costs at least 15 minutes after the 8th: 10 000 four-digit PINs take months.
import { FREE_ATTEMPTS } from '../../shared/lock.ts';

export const WAIT_MS = [30_000, 60_000, 300_000, 900_000] as const;

/** Pause after the `failed`-th wrong PIN in a row (1-based); 0 = the next try is allowed at once. */
export function waitAfter(failed: number): number {
  if (failed < FREE_ATTEMPTS) return 0;
  return WAIT_MS[Math.min(failed - FREE_ATTEMPTS, WAIT_MS.length - 1)] ?? 0;
}
