// The import worker's knowledge of each bank with an API: how to build its client and how to read its errors. Each
// bank's entry lives in its folder (src/integrations/<bank>/worker.ts); run-import.ts works with any provider. One
// entry per token provider of the core (the Record makes a missing one a type error).
import { isTokenProvider, type TokenProviderId } from '@mono/core/providers/info';
import type { ProviderId } from '@mono/core/providers/types';
import { monobank } from '../integrations/monobank/worker.ts';
import type { WorkerProvider } from '../integrations/types.ts';

export const WORKER_PROVIDERS: Record<TokenProviderId, WorkerProvider> = {
  monobank,
};

/** A connection's provider in the worker; one without an API never reaches the import (StartConnection refuses it). */
export function workerProviderOf(provider: ProviderId): WorkerProvider {
  if (!isTokenProvider(provider)) throw new Error(`${provider} has no API`);
  return WORKER_PROVIDERS[provider];
}
