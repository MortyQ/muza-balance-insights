// The only place in the renderer that touches window.balance (the preload's contextBridge object).
// Slices call main through their own api/ wrappers over this; tests/architecture.test.ts checks that nothing else reads window.balance.
// The bridge is wrapped once: the data screens' reads keep their answers (shared/lib readCache), a write makes them stale.
import type { BalanceApi } from '@contract/api.ts';
import { METHODS, type Method } from '@contract/channels.ts';
import { readCache, readKey, type ReadCache } from '@/shared/lib';
import { CACHED_READS, PASS_THROUGH } from './methods.ts';

const CACHED: ReadonlySet<Method> = new Set(CACHED_READS);
const PASSING: ReadonlySet<Method> = new Set(PASS_THROUGH);

type AnyCall = (...args: unknown[]) => Promise<unknown>;

export function wrapBridge(bridge: BalanceApi, cache: ReadCache): BalanceApi {
  const calls = bridge as unknown as Record<Method, AnyCall>;
  const out: Partial<Record<Method, AnyCall>> = {};
  for (const method of METHODS) {
    if (CACHED.has(method)) {
      out[method] = async (...args) => {
        const generation = cache.generation;
        const data = await calls[method](...args);
        cache.put(readKey(method, args), data, generation);
        return data;
      };
    } else if (PASSING.has(method)) {
      out[method] = (...args) => calls[method](...args);
    } else {
      out[method] = async (...args) => {
        const result = await calls[method](...args);
        cache.invalidate();
        return result;
      };
    }
  }
  return out as BalanceApi;
}

export const balanceApi: BalanceApi = wrapBridge((window as unknown as { balance: BalanceApi }).balance, readCache);
