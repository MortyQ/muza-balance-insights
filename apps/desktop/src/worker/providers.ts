// The import worker's knowledge of each bank: how to build its client and how to read its errors. Each bank's entry
// lives in its folder (src/integrations/<bank>/worker.ts); run-import.ts works with any provider. One entry per
// provider of the core (the Record makes a missing one a type error).
import type { ProviderId } from '@mono/core/providers/types';
import { monobank } from '../integrations/monobank/worker.ts';
import type { WorkerProvider } from '../integrations/types.ts';

export const WORKER_PROVIDERS: Record<ProviderId, WorkerProvider> = {
  monobank,
};
