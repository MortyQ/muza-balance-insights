// Cooperative cancellation (desktop «Остановить»): checked before each window and page and after rate-limit waits.
// A fully fetched window is still committed; a cancel never leaves a hole; the next run resumes.
import { afterEach, describe, expect, it } from 'vitest';
import { SyncCancelledError } from '../src/cancel.ts';
import type { Db } from '../src/db.ts';
import { createMonoClient } from '../src/providers/monobank/client.ts';
import type { Clock } from '../src/platform.ts';
import { WINDOW_SEC, getSyncState, planHistory, runPlan, syncAccounts, type SyncContext } from '../src/sync.ts';
import { TEST_TOKEN, fakeClock, fakeMonobank, item, memoryDb, type RawItem } from './helpers.ts';

let db: Db;
afterEach(() => db?.close());

const statementCalls = (calls: Array<{ url: string }>) => calls.filter((c) => c.url.includes('/personal/statement/'));

async function setup(opts: { clock?: Clock & { nowMs(): number }; items?: (since: number, now: number) => RawItem[] } = {}) {
  db = await memoryDb();
  const clock = opts.clock ?? fakeClock();
  const now = Math.floor(clock.nowMs() / 1000);
  const since = now - 3 * WINDOW_SEC + 100; // 3 windows per account
  const spread = (acc: string) => Array.from({ length: 6 }, (_, i) => item(`${acc}-${i}`, since + 50 + i * Math.floor((now - since - 100) / 6), -100));
  const mono = fakeMonobank({
    accounts: [{ id: 'cardA' }, { id: 'cardB' }],
    statements: opts.items ? { cardA: opts.items(since, now), cardB: [] } : { cardA: spread('a'), cardB: spread('b') },
  });
  const controller = new AbortController();
  const ctx: SyncContext = {
    db,
    clock,
    signal: controller.signal,
    api: createMonoClient({ token: TEST_TOKEN, db, fetch: mono.fetch, clock, rateLimitMode: 'wait', signal: controller.signal }),
  };
  await syncAccounts(ctx);
  return { ctx, mono, controller, since, now };
}

async function txCount(): Promise<number> {
  return Number((await db.execute('SELECT COUNT(*) AS n FROM transactions')).rows[0]?.n);
}

describe('cancellation', () => {
  it('already cancelled: no statement request at all', async () => {
    const { ctx, mono, controller, since } = await setup();
    controller.abort();
    await expect(runPlan(ctx, await planHistory(ctx, { sinceSec: since }))).rejects.toBeInstanceOf(SyncCancelledError);
    expect(statementCalls(mono.calls)).toHaveLength(0);
  });

  it('cancel after a window is committed: that window stays, nothing else is requested', async () => {
    const { ctx, mono, controller, since, now } = await setup();
    ctx.onEvent = (e) => {
      if (e.type === 'window-done') controller.abort();
    };
    await expect(runPlan(ctx, await planHistory(ctx, { sinceSec: since }))).rejects.toBeInstanceOf(SyncCancelledError);
    expect(statementCalls(mono.calls)).toHaveLength(1);
    expect(await getSyncState(db, 'cardA')).toMatchObject({ newest: now, oldest: since + 2 * WINDOW_SEC });
    expect(await getSyncState(db, 'cardB')).toBeNull();
  });

  it('cancel during the rate-limit wait: the wait ends, no request after it', async () => {
    let controller: AbortController | undefined;
    const base = fakeClock();
    const sleeps: Array<AbortSignal | undefined> = [];
    const clock = {
      nowMs: () => base.nowMs(),
      // The user presses «Остановить» while we wait for the Monobank slot; the clock ignores the signal on purpose,
      // so the core's own re-check is what stops the run.
      sleep: async (ms: number, signal?: AbortSignal) => {
        sleeps.push(signal);
        controller?.abort();
        await base.sleep(ms);
      },
    };
    const s = await setup({ clock });
    controller = s.controller;
    await expect(runPlan(s.ctx, await planHistory(s.ctx, { sinceSec: s.since }))).rejects.toBeInstanceOf(SyncCancelledError);
    expect(sleeps.length).toBeGreaterThan(0);
    expect(sleeps[0]).toBe(s.controller.signal); // the signal reaches the clock
    // client-info (syncAccounts) took the slot, so the wait comes before the very first window: nothing went out.
    expect(statementCalls(s.mono.calls)).toHaveLength(0);
  });

  it('a clock that rejects on abort (its own error) still surfaces as SyncCancelledError', async () => {
    let controller: AbortController | undefined;
    const base = fakeClock();
    const clock = {
      nowMs: () => base.nowMs(),
      sleep: async (_ms: number, signal?: AbortSignal) => {
        controller?.abort();
        if (signal?.aborted) throw new DOMException('The operation was aborted.', 'AbortError');
      },
    };
    const s = await setup({ clock });
    controller = s.controller;
    await expect(runPlan(s.ctx, await planHistory(s.ctx, { sinceSec: s.since }))).rejects.toBeInstanceOf(SyncCancelledError);
  });

  it('cancel between pages of one window: the partial window is not committed', async () => {
    // 700 items in the freshest window: a full page of 500 means "there may be more" → a second page is needed.
    const { ctx, mono, controller, since } = await setup({
      items: (_s, n) => Array.from({ length: 700 }, (_, i) => item(`p-${i}`, n - 1000 - i * 60, -100)),
    });
    let pages = 0;
    ctx.onEvent = (e) => {
      if (e.type === 'page' && ++pages === 1) controller.abort();
    };
    await expect(runPlan(ctx, await planHistory(ctx, { sinceSec: since }))).rejects.toBeInstanceOf(SyncCancelledError);
    expect(statementCalls(mono.calls)).toHaveLength(1);
    expect(await txCount()).toBe(0);
    expect(await getSyncState(db, 'cardA')).toBeNull();
  });

  it('cancel during an in-flight request: SyncCancelledError, not a network error; the fetch saw the abort', async () => {
    const { ctx, mono, controller, since } = await setup();
    const seen: AbortSignal[] = [];
    let n = 0;
    // Wrap the transport: the first statement request is "in flight" when the user cancels.
    const api = createMonoClient({
      token: TEST_TOKEN,
      db,
      clock: ctx.clock,
      rateLimitMode: 'wait',
      signal: controller.signal,
      fetch: async (url, init) => {
        if (init.signal) seen.push(init.signal);
        if (url.includes('/personal/statement/') && n++ === 0) {
          controller.abort();
          throw new DOMException('This operation was aborted', 'AbortError');
        }
        return mono.fetch(url, init);
      },
    });
    await expect(runPlan({ ...ctx, api }, await planHistory(ctx, { sinceSec: since }))).rejects.toBeInstanceOf(SyncCancelledError);
    expect(seen.at(-1)?.aborted).toBe(true); // the request signal combines the user's signal with the timeout
    expect(await txCount()).toBe(0);
  });

  it('after a cancel, the next run resumes and ends with the full, hole-free history', async () => {
    const { ctx, mono, controller, since } = await setup();
    let done = 0;
    ctx.onEvent = (e) => {
      if (e.type === 'window-done' && ++done === 2) controller.abort();
    };
    await expect(runPlan(ctx, await planHistory(ctx, { sinceSec: since }))).rejects.toBeInstanceOf(SyncCancelledError);
    expect(await txCount()).toBeLessThan(12);

    const fresh = new AbortController();
    const resumed: SyncContext = {
      ...ctx,
      signal: fresh.signal,
      onEvent: undefined,
      api: createMonoClient({ token: TEST_TOKEN, db, fetch: mono.fetch, clock: ctx.clock, rateLimitMode: 'wait', signal: fresh.signal }),
    };
    await runPlan(resumed, await planHistory(resumed, { sinceSec: since }));
    expect(await txCount()).toBe(12);
    for (const acc of ['cardA', 'cardB']) expect(await getSyncState(db, acc), acc).toMatchObject({ oldest: since });
  });

  // The signal only in SyncContext (the client has none): the core's own window/page checks must stop the run.
  it('signal only in SyncContext: cancel after a window → nothing else is requested', async () => {
    const s = await setup();
    const ctx: SyncContext = { ...s.ctx, api: createMonoClient({ token: TEST_TOKEN, db, fetch: s.mono.fetch, clock: s.ctx.clock, rateLimitMode: 'wait' }) };
    const afterCancel: string[] = [];
    ctx.onEvent = (e) => {
      if (s.controller.signal.aborted) afterCancel.push(e.type);
      if (e.type === 'window-done') s.controller.abort();
    };
    await expect(runPlan(ctx, await planHistory(ctx, { sinceSec: s.since }))).rejects.toBeInstanceOf(SyncCancelledError);
    expect(statementCalls(s.mono.calls)).toHaveLength(1);
    expect(afterCancel).toEqual([]); // no «window started» in the UI after «Остановить»
  });

  it('signal only in SyncContext: cancel between pages → the partial window is not committed', async () => {
    const s = await setup({ items: (_s, n) => Array.from({ length: 700 }, (_, i) => item(`q-${i}`, n - 1000 - i * 60, -100)) });
    const ctx: SyncContext = { ...s.ctx, api: createMonoClient({ token: TEST_TOKEN, db, fetch: s.mono.fetch, clock: s.ctx.clock, rateLimitMode: 'wait' }) };
    ctx.onEvent = (e) => {
      if (e.type === 'page') s.controller.abort();
    };
    await expect(runPlan(ctx, await planHistory(ctx, { sinceSec: s.since }))).rejects.toBeInstanceOf(SyncCancelledError);
    expect(statementCalls(s.mono.calls)).toHaveLength(1);
    expect(await txCount()).toBe(0);
  });

  it('without a signal nothing changes (MCP / CLI path)', async () => {
    const s = await setup();
    const ctx: SyncContext = { ...s.ctx, signal: undefined, api: createMonoClient({ token: TEST_TOKEN, db, fetch: s.mono.fetch, clock: s.ctx.clock }) };
    await runPlan(ctx, await planHistory(ctx, { sinceSec: s.since }));
    expect(await txCount()).toBe(12);
  });
});
