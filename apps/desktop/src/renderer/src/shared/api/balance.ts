// The only place in the renderer that touches window.balance (the preload's contextBridge object).
// Slices call main through their own api/ wrappers over this; tests/architecture.test.ts checks that nothing else reads window.balance.
// The bridge is wrapped once: the data screens' reads keep their answers (shared/lib readCache), a write makes them stale.
// Two screens asking the same read at once (home's spending block and its «What's unusual» slide) share one request.
import type { BalanceApi } from '@contract/api.ts';
import { METHODS, type Method } from '@contract/channels.ts';
import { readCache, readKey, type ReadCache } from '@/shared/lib';
import { CACHED_READS, PASS_THROUGH } from './methods.ts';

const CACHED: ReadonlySet<Method> = new Set(CACHED_READS);
const PASSING: ReadonlySet<Method> = new Set(PASS_THROUGH);

type AnyCall = (...args: unknown[]) => Promise<unknown>;

/** The preload's subscriptions next to the methods: the wrapper hands them over as they are. */
export const SUBSCRIPTIONS = ['onProgress', 'onUpdate', 'onOpenSettings', 'onLock', 'onDbState'] as const satisfies ReadonlyArray<
  keyof BalanceApi
>;

export function wrapBridge(bridge: BalanceApi, cache: ReadCache): BalanceApi {
  const calls = bridge as unknown as Record<Method, AnyCall>;
  const out: Partial<Record<Method, AnyCall>> = {};
  // Reads in flight by key, with the generation they started under: a read started before a data change is not shared.
  const inFlight = new Map<string, { generation: number; answer: Promise<unknown> }>();
  for (const method of METHODS) {
    if (CACHED.has(method)) {
      out[method] = (...args) => {
        const key = readKey(method, args);
        const generation = cache.generation;
        const running = inFlight.get(key);
        if (running && running.generation === generation) return running.answer;
        const answer: Promise<unknown> = Promise.resolve()
          .then(() => calls[method](...args))
          .then((data) => {
            cache.put(key, data, generation);
            return data;
          })
          .finally(() => {
            if (inFlight.get(key)?.answer === answer) inFlight.delete(key);
          });
        inFlight.set(key, { generation, answer });
        return answer;
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
  const subscriptions = Object.fromEntries(
    SUBSCRIPTIONS.map((name) => [name, (cb: never) => (bridge[name] as (cb: never) => () => void)(cb)]),
  );
  return { ...out, ...subscriptions } as BalanceApi;
}

export const balanceApi: BalanceApi = wrapBridge((window as unknown as { balance: BalanceApi }).balance, readCache);
