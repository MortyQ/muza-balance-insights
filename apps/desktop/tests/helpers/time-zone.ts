// Runs the tests of a describe block in another system time zone. Node re-reads process.env.TZ on assignment, for Date
// and Intl alike; the suite's default zone is set in vitest.config.ts.
import { afterEach, beforeEach, vi } from 'vitest';

export function inTimeZone(zone: string): void {
  beforeEach(() => void vi.stubEnv('TZ', zone));
  afterEach(() => void vi.unstubAllEnvs());
}
