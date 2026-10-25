// @vitest-environment happy-dom
// The read cache of the data screens: ReadCache (shared/lib), the bridge wrapper that fills it and makes it stale
// (shared/api/balance.ts), and useAsyncData starting from a kept answer. Fictional data only.
import { effectScope, nextTick, ref } from 'vue';
import { describe, expect, it, vi } from 'vitest';
import type { BalanceApi, MonthOverviewQuery } from '@contract/api.ts';
import { METHODS } from '@contract/channels.ts';
import { SUBSCRIPTIONS, wrapBridge } from '@/shared/api/balance.ts';
import { CACHED_READS, PASS_THROUGH, WRITES } from '@/shared/api/methods.ts';
import { ReadCache, readKey, READ_CACHE_SIZE, READ_FRESH_MS } from '@/shared/lib/readCache.ts';
import { useAsyncData } from '@/shared/lib/useAsyncData.ts';

const flush = () => new Promise((r) => setTimeout(r, 0));

function clock() {
  let now = 1_000_000;
  return { now: () => now, advance: (ms: number) => (now += ms) };
}

describe('ReadCache', () => {
  it('fresh while the generation holds and younger than the limit; stale after a change or with age', () => {
    const c = clock();
    const cache = new ReadCache(c.now);
    cache.put('a', 1, cache.generation);
    expect(cache.peek('a')).toEqual({ data: 1, fresh: true });
    c.advance(READ_FRESH_MS);
    expect(cache.peek('a')).toEqual({ data: 1, fresh: false });
    cache.put('b', 2, cache.generation);
    cache.invalidate();
    expect(cache.peek('b')).toEqual({ data: 2, fresh: false });
    expect(cache.peek('none')).toBeNull();
  });

  it('an answer put under the generation of its request start lands stale when a change came in between', () => {
    const cache = new ReadCache();
    const started = cache.generation;
    cache.invalidate();
    cache.put('a', 1, started);
    expect(cache.peek('a')?.fresh).toBe(false);
  });

  it('bounded: the least recently used answer goes first', () => {
    const cache = new ReadCache(Date.now, 3);
    for (const k of ['a', 'b', 'c']) cache.put(k, k, 0);
    cache.peek('a');
    cache.put('d', 'd', 0);
    expect(cache.peek('b')).toBeNull();
    expect(['a', 'c', 'd'].map((k) => cache.peek(k)?.data)).toEqual(['a', 'c', 'd']);
    expect(READ_CACHE_SIZE).toBe(50);
  });
});

describe('the bridge wrapper', () => {
  it('every method is a cached read, a pass-through or a write — exactly once', () => {
    const placed = [...CACHED_READS, ...PASS_THROUGH, ...WRITES];
    expect(new Set(placed).size).toBe(placed.length);
    expect([...placed].sort()).toEqual([...METHODS].sort());
  });

  function bridge(overrides: Partial<Record<string, (...a: unknown[]) => Promise<unknown>>> = {}) {
    const calls: string[] = [];
    const fake = new Proxy(
      {},
      {
        get: (_t, method: string) =>
          overrides[method] ??
          (async (...args: unknown[]) => {
            calls.push(`${method}:${JSON.stringify(args)}`);
            return { method, args };
          }),
      },
    ) as unknown as BalanceApi;
    return { fake, calls };
  }

  it('hands every subscription of the preload over as it is', () => {
    const off = () => undefined;
    const subs = Object.fromEntries(SUBSCRIPTIONS.map((name) => [name, vi.fn(() => off)]));
    const api = wrapBridge(subs as unknown as BalanceApi, new ReadCache());
    const cb = () => undefined;
    for (const name of SUBSCRIPTIONS) {
      expect(api[name](cb)).toBe(off);
      expect(subs[name]).toHaveBeenCalledWith(cb);
    }
  });

  it('a data read keeps its answer under its key; a write makes it stale; a pass-through does not', async () => {
    const cache = new ReadCache();
    const api = wrapBridge(bridge().fake, cache);
    const q: MonthOverviewQuery = { month: '2026-01' };
    await api.getMonthOverview(q);
    expect(cache.peek(readKey('getMonthOverview', [q]))).toMatchObject({ fresh: true });
    await api.getSyncStatus();
    await api.setTheme('dark');
    expect(cache.peek(readKey('getMonthOverview', [q]))?.fresh).toBe(true);
    await api.addReserve({ name: 'Вигаданий', currency: 980, amount: 100, until: null, participantId: null });
    expect(cache.peek(readKey('getMonthOverview', [q]))?.fresh).toBe(false);
  });

  it('a failed read keeps nothing; a failed write changes nothing', async () => {
    const cache = new ReadCache();
    const fail = async () => {
      throw new Error('Operation failed');
    };
    const api = wrapBridge(bridge({ getMonthOverview: fail, addReserve: fail }).fake, cache);
    const q: MonthOverviewQuery = { month: '2026-01' };
    await expect(api.getMonthOverview(q)).rejects.toThrow();
    expect(cache.peek(readKey('getMonthOverview', [q]))).toBeNull();
    const before = cache.generation;
    await expect(api.addReserve({ name: 'x', currency: 980, amount: 1, until: null, participantId: null })).rejects.toThrow();
    expect(cache.generation).toBe(before);
  });

  it('a read that raced a write lands stale', async () => {
    const cache = new ReadCache();
    let answer: (v: unknown) => void = () => undefined;
    const api = wrapBridge(bridge({ getMonthOverview: () => new Promise((r) => (answer = r)) }).fake, cache);
    const q: MonthOverviewQuery = { month: '2026-01' };
    const read = api.getMonthOverview(q);
    await api.deleteReserve(1);
    answer({ month: '2026-01' });
    await read;
    expect(cache.peek(readKey('getMonthOverview', [q]))?.fresh).toBe(false);
  });
});

describe('useAsyncData with a kept answer', () => {
  function setup(kept: () => { data: number; fresh: boolean } | null) {
    const loud = ref(0);
    const quiet = ref(0);
    let resolve: (v: number) => void = () => undefined;
    const load = vi.fn(() => new Promise<number>((r) => (resolve = r)));
    const scope = effectScope();
    const { state, reload } = scope.run(() => useAsyncData(load, [loud], { quiet: [quiet], cached: kept }))!;
    return { loud, quiet, load, state, reload, answer: (v: number) => resolve(v), stop: () => scope.stop() };
  }

  it('fresh: shown at once, no request', () => {
    const s = setup(() => ({ data: 7, fresh: true }));
    expect(s.load).not.toHaveBeenCalled();
    expect(s.state.value).toEqual({ status: 'success', data: 7 });
    s.stop();
  });

  it('stale: shown at once, then replaced by a quiet load (no «loading» in between)', async () => {
    const s = setup(() => ({ data: 7, fresh: false }));
    expect(s.load).toHaveBeenCalledTimes(1);
    expect(s.state.value).toEqual({ status: 'success', data: 7 });
    s.answer(8);
    await flush();
    expect(s.state.value).toEqual({ status: 'success', data: 8 });
    s.stop();
  });

  it('none: as without the option — «loading», then the answer', async () => {
    const s = setup(() => null);
    expect(s.state.value).toEqual({ status: 'loading', data: null });
    s.answer(1);
    await flush();
    expect(s.state.value).toEqual({ status: 'success', data: 1 });
    s.stop();
  });

  it('reload() always asks, even with a fresh answer kept', async () => {
    const s = setup(() => ({ data: 7, fresh: true }));
    void s.reload();
    expect(s.load).toHaveBeenCalledTimes(1);
    s.answer(9);
    await flush();
    expect(s.state.value).toEqual({ status: 'success', data: 9 });
    s.stop();
  });

  it('an answer to an older request never replaces a kept one shown later', async () => {
    let kept: { data: number; fresh: boolean } | null = null;
    const s = setup(() => kept);
    const first = s.answer;
    kept = { data: 5, fresh: true };
    s.loud.value++;
    await nextTick();
    expect(s.state.value).toEqual({ status: 'success', data: 5 });
    first(1);
    await flush();
    expect(s.state.value).toEqual({ status: 'success', data: 5 });
    s.stop();
  });
});

describe('a screen over the real cache', () => {
  function screen() {
    const cache = new ReadCache();
    const getMonthOverview = vi.fn(async (q: MonthOverviewQuery) => ({ month: q.month }));
    const api = wrapBridge(
      new Proxy({}, { get: (_t, m: string) => (m === 'getMonthOverview' ? getMonthOverview : async () => undefined) }) as unknown as BalanceApi,
      cache,
    );
    const month = ref('2026-01');
    const query = () => ({ month: month.value });
    const scope = effectScope();
    const { state } = scope.run(() =>
      useAsyncData(() => api.getMonthOverview(query()), [month], { cached: () => cache.peek(readKey('getMonthOverview', [query()])) }),
    )!;
    return { api, cache, month, state, getMonthOverview, stop: () => scope.stop() };
  }

  it('a month switched back within a minute: its numbers at once, no new request', async () => {
    const s = screen();
    await flush();
    s.month.value = '2026-02';
    await flush();
    expect(s.getMonthOverview).toHaveBeenCalledTimes(2);
    s.month.value = '2026-01';
    await nextTick();
    expect(s.state.value).toEqual({ status: 'success', data: { month: '2026-01' } });
    expect(s.getMonthOverview).toHaveBeenCalledTimes(2);
    s.stop();
  });

  it('after a reserve is added the month is asked for again', async () => {
    const s = screen();
    await flush();
    s.month.value = '2026-02';
    await flush();
    await s.api.addReserve({ name: 'Вигаданий', currency: 980, amount: 100, until: null, participantId: null });
    s.month.value = '2026-01';
    await flush();
    expect(s.getMonthOverview).toHaveBeenCalledTimes(3);
    expect(s.getMonthOverview).toHaveBeenLastCalledWith({ month: '2026-01' });
    s.stop();
  });
});
