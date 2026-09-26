// The import worker's knowledge of each bank: how to build its client and how to read its errors. Everything
// provider-specific in the worker is here; run-import.ts works with any provider. One entry per provider of the core
// (the Record makes a missing one a type error).
import type { Db } from '@mono/core/db';
import type { Clock, FetchLike } from '@mono/core/platform';
import { MonoApiError, createMonoClient } from '@mono/core/providers/monobank/client';
import type { ProviderClient, ProviderId } from '@mono/core/providers/types';
import type { ErrorKind } from '../shared/import-protocol.ts';

export type ClientDeps = {
  connectionId: number;
  token: string;
  db: Db;
  /** Already allowlisted to the provider's services. */
  fetch: FetchLike;
  clock: Clock;
  signal: AbortSignal;
  onWait: (ms: number) => void;
};

export interface WorkerProvider {
  create(d: ClientDeps): ProviderClient;
  /** This provider's error → kind + fixed, token-free text; null = not its error. */
  describe(err: unknown): { kind: ErrorKind; message: string } | null;
  /** Failures worth waiting out: no connection / timeout, the bank's 5xx. Null = not transient or not its error. */
  transient(err: unknown): 'network' | 'server' | null;
  /** For the log: the error's name and status — never its message (it may quote a response). Null = not its error. */
  tag(err: unknown): string | null;
}

export const WORKER_PROVIDERS: Record<ProviderId, WorkerProvider> = {
  monobank: {
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
      if (err.status === 401 || err.status === 403) return { kind: 'auth', message: 'Monobank не принял токен. Проверь токен и введи его заново.' };
      if (err.status === null) return { kind: 'network', message: 'Нет связи с Monobank. Импорт продолжится со следующего запуска.' };
      // Already redacted by the core client.
      return { kind: 'other', message: err.message.slice(0, 300) };
    },
    transient: (err) => {
      if (!(err instanceof MonoApiError)) return null;
      if (err.status === null) return 'network';
      return err.status >= 500 ? 'server' : null;
    },
    tag: (err) => (err instanceof MonoApiError ? `${err.name} status=${err.status ?? 'none'}` : null),
  },
};
