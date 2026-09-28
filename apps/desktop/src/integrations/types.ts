// What each bank's folder in src/integrations provides. `desktop.ts` — main's side, checked before anything is stored
// or sent to the worker (assembled in src/net/providers.ts); `worker.ts` — the import worker's side (assembled in
// src/worker/providers.ts). The two sides stay in separate files so each process imports only its own.
import type { Db } from '@mono/core/db';
import type { Clock, FetchLike } from '@mono/core/platform';
import type { ProviderClient } from '@mono/core/providers/types';
import type { ErrorKind } from '../shared/import-protocol.ts';

export interface DesktopProvider {
  /** Name in the UI. */
  bank: string;
  /** A credential-shaped string; nothing else is kept. */
  credential: RegExp;
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
