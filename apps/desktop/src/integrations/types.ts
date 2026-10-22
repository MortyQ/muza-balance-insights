// What each bank's folder in src/integrations provides (banks with an API only; a file-only bank has no folder here).
// `desktop.ts` — which trusted service its client may reach (assembled in src/net/providers.ts); `worker.ts` — the import worker's side (assembled in
// src/worker/providers.ts). The two sides stay in separate files so each process imports only its own.
import type { Db } from '@mono/core/storage/db';
import type { Clock, FetchLike } from '@mono/core/shared/platform';
import type { ProviderClient } from '@mono/core/providers/types';
import type { ServiceId } from '../net/allowlist.ts';
import type { ErrorKind } from '../shared/import-protocol.ts';

/** A bank with an API, main's side. Its name and credential shape are the core's (providers/info.ts). */
export interface DesktopProvider {
  /** The trusted service its client may reach (net/allowlist.ts); a provider names one, it cannot add hosts. */
  service: ServiceId;
}

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
  /** This provider's error → its code for the UI; null = not its error. */
  describe(err: unknown): ErrorKind | null;
  /** Failures worth waiting out: no connection / timeout, the bank's 5xx. Null = not transient or not its error. */
  transient(err: unknown): 'network' | 'server' | null;
  /** For the log: the error's name and status — never its message (it may quote a response). Null = not its error. */
  tag(err: unknown): string | null;
}
