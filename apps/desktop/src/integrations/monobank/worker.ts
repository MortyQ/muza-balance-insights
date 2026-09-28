// Monobank, the import worker's side: how to build its client and how to read its errors.
import { MonoApiError, createMonoClient } from '@mono/core/providers/monobank/client';
import type { WorkerProvider } from '../types.ts';

export const monobank: WorkerProvider = {
  create: (d) =>
    createMonoClient({
      connectionId: d.connectionId,
      token: d.token,
      db: d.db,
      fetch: d.fetch,
      clock: d.clock,
      rateLimitMode: 'wait',
      signal: d.signal,
      onWait: d.onWait,
    }),
  describe: (err) => {
    if (!(err instanceof MonoApiError)) return null;
    if (err.status === 401 || err.status === 403) return 'auth';
    if (err.status === null) return 'network';
    return 'bank';
  },
  transient: (err) => {
    if (!(err instanceof MonoApiError)) return null;
    if (err.status === null) return 'network';
    return err.status >= 500 ? 'server' : null;
  },
  tag: (err) => (err instanceof MonoApiError ? `${err.name} status=${err.status ?? 'none'}` : null),
};
