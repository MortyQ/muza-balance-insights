// First import order: the freshest window of every account first, then older history (round-robin).
import { afterEach, describe, expect, it } from 'vitest';
import type { Db } from '../src/db.ts';
import { createMonoClient } from '../src/monoApi.ts';
import {
  WINDOW_SEC,
  getSyncState,
  interleavePlan,
  planHistory,
  runPlan,
  syncAccounts,
  type SyncContext,
  type SyncEvent,
  type Window,
} from '../src/sync.ts';
import { TEST_TOKEN, fakeClock, fakeMonobank, item, memoryDb } from './helpers.ts';

let db: Db;
afterEach(() => db?.close());

const w = (n: number): Window => ({ from: n * 10, to: n * 10 + 10 });

function statementUrl(url: string) {
  const m = /statement\/([^/]+)\/(\d+)\/(\d+)$/.exec(url);
  return m ? { acc: m[1], from: Number(m[2]), to: Number(m[3]) } : null;
}

describe('interleavePlan', () => {
  it('round k = the k-th window of every account, in plan order; each account keeps its own order', () => {
    const plan = new Map<string, Window[]>([
      ['a', [w(9), w(8), w(7)]],
      ['b', [w(19)]],
      ['c', []],
      ['j', [w(29), w(28)]],
    ]);
    expect(interleavePlan(plan).map((p) => [p.accountId, p.window.from / 10, p.index, p.total, p.round])).toEqual([
      ['a', 9, 1, 3, 1],
      ['b', 19, 1, 1, 1],
      ['j', 29, 1, 2, 1],
      ['a', 8, 2, 3, 2],
      ['j', 28, 2, 2, 2],
      ['a', 7, 3, 3, 3],
    ]);
  });

  it('an empty plan gives nothing', () => {
    expect(interleavePlan(new Map())).toEqual([]);
    expect(interleavePlan(new Map([['a', []]]))).toEqual([]);
  });
});

describe('runPlan order on a mock Monobank', () => {
  async function setup(intercept?: (i: number) => 'throw' | undefined) {
    db = await memoryDb();
    const clock = fakeClock();
    const now = Math.floor(clock.nowMs() / 1000);
    const since = now - 3 * WINDOW_SEC + 100; // → 3 windows per account
    const spread = (acc: string) =>
      Array.from({ length: 9 }, (_, i) => item(`${acc}-${i}`, since + 50 + i * Math.floor((now - since - 100) / 9), -100));
    const mono = fakeMonobank({
      accounts: [{ id: 'cardA' }, { id: 'cardB' }],
      jars: [{ id: 'jarC', balance: 500 }],
      statements: { cardA: spread('a'), cardB: spread('b'), jarC: spread('c') },
      intercept: intercept ? (i) => intercept(i) : undefined,
    });
    const events: SyncEvent[] = [];
    const ctx: SyncContext = {
      db,
      clock,
      api: createMonoClient({ token: TEST_TOKEN, db, fetch: mono.fetch, clock, rateLimitMode: 'wait' }),
      onEvent: (e) => events.push(e),
    };
    await syncAccounts(ctx);
    return { ctx, mono, events, now, since };
  }

  it('the first N statement requests are the freshest window of each of the N accounts', async () => {
    const { ctx, mono, events, now, since } = await setup();
    await runPlan(ctx, await planHistory(ctx, { sinceSec: since }));

    const reqs = mono.calls.map((c) => statementUrl(c.url)).filter((r) => r !== null);
    expect(reqs).toHaveLength(9);
    // Cards first, then jars (listAccountIds order); round 1 ends at "now" for everyone.
    expect(reqs.slice(0, 3).map((r) => [r.acc, r.to])).toEqual([
      ['cardA', now],
      ['cardB', now],
      ['jarC', now],
    ]);
    expect(reqs.map((r) => r.acc)).toEqual(['cardA', 'cardB', 'jarC', 'cardA', 'cardB', 'jarC', 'cardA', 'cardB', 'jarC']);
    // Within an account the windows still go back in time.
    const a = reqs.filter((r) => r.acc === 'cardA');
    expect(a[0]!.from).toBeGreaterThan(a[1]!.from);
    expect(a[1]!.from).toBeGreaterThan(a[2]!.from);

    // Progress events carry the round.
    const starts = events.filter((e) => e.type === 'window-start');
    expect(starts.map((e) => (e.type === 'window-start' ? [e.accountId, e.index, e.total, e.round] : null))).toEqual([
      ['cardA', 1, 3, 1],
      ['cardB', 1, 3, 1],
      ['jarC', 1, 3, 1],
      ['cardA', 2, 3, 2],
      ['cardB', 2, 3, 2],
      ['jarC', 2, 3, 2],
      ['cardA', 3, 3, 3],
      ['cardB', 3, 3, 3],
      ['jarC', 3, 3, 3],
    ]);
    const rows = await db.execute('SELECT COUNT(*) AS n FROM transactions');
    expect(Number(rows.rows[0]?.n)).toBe(27);
  });

  it('interrupted after round 1: every account is already current; the next run resumes the history without holes', async () => {
    // call 0 = client-info, 1..3 = round 1, 4 = first window of round 2 → fails.
    let fail = true;
    const { ctx, mono, now, since } = await setup((i) => (fail && i === 4 ? 'throw' : undefined));
    await expect(runPlan(ctx, await planHistory(ctx, { sinceSec: since }))).rejects.toThrow();

    for (const acc of ['cardA', 'cardB', 'jarC']) {
      expect(await getSyncState(db, acc), acc).toMatchObject({ newest: now, oldest: since + 2 * WINDOW_SEC });
    }

    fail = false;
    const callsBefore = mono.calls.length;
    await runPlan(ctx, await planHistory(ctx, { sinceSec: since }));
    const resumed = mono.calls.slice(callsBefore).map((c) => statementUrl(c.url)!);
    // Round 1 of the resume = the short forward refresh of each account, then the two older windows each.
    expect(resumed.map((r) => r.acc)).toEqual(['cardA', 'cardB', 'jarC', 'cardA', 'cardB', 'jarC', 'cardA', 'cardB', 'jarC']);
    for (const acc of ['cardA', 'cardB', 'jarC']) {
      expect(await getSyncState(db, acc), acc).toMatchObject({ oldest: since });
    }
    const rows = await db.execute('SELECT COUNT(*) AS n FROM transactions');
    expect(Number(rows.rows[0]?.n)).toBe(27);
  });
});
