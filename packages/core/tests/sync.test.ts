import { afterEach, describe, expect, it } from 'vitest';
import { RESYNC_OVERLAP_SEC } from '../src/constants.ts';
import { MAX_STATEMENT_WINDOW_SEC } from '../src/providers/monobank/constants.ts';
import type { Db } from '../src/db.ts';
import { createMonoClient } from '../src/providers/monobank/client.ts';
import {
  WINDOW_SEC,
  commitWindow,
  defaultAccountSelection,
  getSyncState,
  planAccountWindows,
  planHistory,
  runPlan,
  splitWindows,
  syncAccounts,
  syncRecent,
  syncWindow,
  type SyncContext,
  type Window,
} from '../src/sync.ts';
import { TEST_TOKEN, allTextInDb, fakeClock, fakeMonobank, insertAccount, item, memoryDb, type RawItem } from './helpers.ts';

const DAY = 86_400;
let db: Db;
afterEach(() => db?.close());

function makeCtx(mono: ReturnType<typeof fakeMonobank>, clock = fakeClock(), mode: 'wait' | 'fail' = 'wait') {
  const warnings: string[] = [];
  const ctx: SyncContext = {
    db,
    clock,
    api: createMonoClient({ token: TEST_TOKEN, db, fetch: mono.fetch, clock, rateLimitMode: mode }),
    warn: (m) => warnings.push(m),
  };
  return { ctx, warnings, clock };
}

async function txRows(accountId?: string) {
  const rs = await db.execute({
    sql: `SELECT id, hold, amount, is_cancelled, local_date FROM transactions ${accountId ? 'WHERE account_id = ?' : ''} ORDER BY time`,
    args: accountId ? [accountId] : [],
  });
  return rs.rows.map((r) => ({
    id: String(r.id),
    hold: Number(r.hold),
    amount: Number(r.amount),
    cancelled: Number(r.is_cancelled),
    localDate: String(r.local_date),
  }));
}

function statementUrl(url: string) {
  const m = /statement\/([^/]+)\/(\d+)\/(\d+)$/.exec(url);
  return m ? { acc: m[1], from: Number(m[2]), to: Number(m[3]) } : null;
}

describe('splitWindows', () => {
  it('windows never exceed the API maximum and cover [from, to] without gaps', () => {
    const from = 1_700_000_000;
    const to = from + 100 * DAY + 123;
    const ws = splitWindows(from, to);
    expect(ws[0]?.from).toBe(from);
    expect(ws.at(-1)?.to).toBe(to);
    for (const w of ws) expect(w.to - w.from).toBeLessThanOrEqual(MAX_STATEMENT_WINDOW_SEC);
    for (let i = 1; i < ws.length; i++) expect(ws[i]?.from).toBe(ws[i - 1]?.to);
    expect(ws).toHaveLength(Math.ceil((to - from) / WINDOW_SEC));
  });

  it('exact multiple → no empty tail window; empty range → no windows', () => {
    expect(splitWindows(0, 2 * WINDOW_SEC)).toEqual([
      { from: 0, to: WINDOW_SEC },
      { from: WINDOW_SEC, to: 2 * WINDOW_SEC },
    ]);
    expect(splitWindows(10, 10)).toEqual([]);
  });
});

describe('planAccountWindows: coverage stays contiguous', () => {
  const now = 1_750_000_000;

  function assertContiguous(state: { oldest: number; newest: number } | null, windows: Window[]) {
    let cov = state ? { ...state } : null;
    for (const w of windows) {
      if (cov) {
        expect(w.from <= cov.newest && w.to >= cov.oldest, `window ${w.from}-${w.to} touches coverage`).toBe(true);
        cov = { oldest: Math.min(cov.oldest, w.from), newest: Math.max(cov.newest, w.to) };
      } else {
        cov = { oldest: w.from, newest: w.to };
      }
    }
    return cov;
  }

  it('fresh import: newest first, from now down to since', () => {
    const since = now - 70 * DAY;
    const ws = planAccountWindows(null, since, now);
    expect(ws[0]?.to).toBe(now);
    expect(ws.at(-1)?.from).toBe(since);
    expect(assertContiguous(null, ws)).toEqual({ oldest: since, newest: now });
  });

  it('existing coverage: forward from newest − 3 days, then backward to since — no holes', () => {
    const state = { oldest: now - 40 * DAY, newest: now - 10 * DAY, lastSyncAt: null };
    const since = now - 100 * DAY;
    const ws = planAccountWindows(state, since, now);
    expect(ws[0]?.from).toBe(state.newest - RESYNC_OVERLAP_SEC);
    expect(assertContiguous(state, ws)).toEqual({ oldest: since, newest: now });
  });

  it('since inside coverage → forward only; no since, no coverage → nothing', () => {
    const state = { oldest: now - 40 * DAY, newest: now - DAY, lastSyncAt: null };
    const ws = planAccountWindows(state, now - 20 * DAY, now);
    expect(ws).toEqual([{ from: state.newest - RESYNC_OVERLAP_SEC, to: now }]);
    expect(planAccountWindows(null, null, now)).toEqual([]);
  });
});

describe('pagination', () => {
  it('exactly 500 → second request with to = oldest received time; duplicates deduped', async () => {
    db = await memoryDb();
    await insertAccount(db, 'a');
    const base = 1_749_000_000;
    // 700 transactions, 60 s apart, all inside one window
    const items: RawItem[] = Array.from({ length: 700 }, (_, i) => item(`t${i}`, base + i * 60, -100));
    const mono = fakeMonobank({ statements: { a: items } });
    const { ctx } = makeCtx(mono);
    const w = { from: base - 10, to: base + 700 * 60 };

    await syncWindow(ctx, 'a', w);

    const reqs = mono.calls.map((c) => statementUrl(c.url));
    expect(reqs).toHaveLength(2);
    expect(reqs[0]).toMatchObject({ from: w.from, to: w.to });
    const oldestOfPage1 = base + 200 * 60; // newest-first: page 1 = t699..t200
    expect(reqs[1]).toMatchObject({ from: w.from, to: oldestOfPage1 });
    expect(await txRows()).toHaveLength(700);
  }, 20_000); // 700-row upsert + derived passes; slow only on a heavily loaded machine

  it('fewer than 500 → single request', async () => {
    db = await memoryDb();
    await insertAccount(db, 'a');
    const mono = fakeMonobank({ statements: { a: [item('t1', 1000, -1)] } });
    const { ctx } = makeCtx(mono);
    await syncWindow(ctx, 'a', { from: 0, to: 2000 });
    expect(mono.calls).toHaveLength(1);
  });

  it('interruption mid-pagination → nothing written, window not counted as covered', async () => {
    db = await memoryDb();
    await insertAccount(db, 'a');
    const base = 1_749_000_000;
    const items = Array.from({ length: 600 }, (_, i) => item(`t${i}`, base + i, -100));
    const mono = fakeMonobank({ statements: { a: items }, intercept: (i) => (i === 1 ? 'throw' : undefined) });
    const { ctx } = makeCtx(mono);

    await expect(syncWindow(ctx, 'a', { from: base, to: base + 1000 })).rejects.toThrow(/Сетевая ошибка/);
    expect(await txRows()).toEqual([]);
    expect(await getSyncState(db, 'a')).toBeNull();
  });

  it('≥ 500 transactions in the same second → explicit error instead of an infinite loop', async () => {
    db = await memoryDb();
    await insertAccount(db, 'a');
    const items = Array.from({ length: 500 }, (_, i) => item(`t${i}`, 5000, -1));
    const { ctx } = makeCtx(fakeMonobank({ statements: { a: items } }));
    await expect(syncWindow(ctx, 'a', { from: 0, to: 5000 })).rejects.toThrow(/Пагинация не продвигается/);
  });
});

describe('upsert & holds', () => {
  it('a hold that later settles is updated in place (hold 1 → 0, amount changes)', async () => {
    db = await memoryDb();
    await insertAccount(db, 'a');
    const statements: Record<string, RawItem[]> = { a: [item('h1', 1500, -10_000, { hold: true })] };
    const { ctx, clock } = makeCtx(fakeMonobank({ statements }));
    await syncWindow(ctx, 'a', { from: 1000, to: 2000 });
    expect(await txRows()).toMatchObject([{ id: 'h1', hold: 1, amount: -10_000 }]);

    statements.a = [item('h1', 1500, -9_870, { hold: false })];
    clock.advance(60_000);
    await syncWindow(ctx, 'a', { from: 1000, to: 2000 });
    expect(await txRows()).toMatchObject([{ id: 'h1', hold: 0, amount: -9_870, cancelled: 0 }]);
  });

  it('hold missing on re-fetch → is_cancelled = 1; reappears → 0; non-hold missing → untouched + warning', async () => {
    db = await memoryDb();
    await insertAccount(db, 'a');
    const statements: Record<string, RawItem[]> = {
      a: [item('h1', 1500, -10_000, { hold: true }), item('p1', 1600, -500)],
    };
    const { ctx, warnings } = makeCtx(fakeMonobank({ statements }));
    const w = { from: 1000, to: 2000 };
    await syncWindow(ctx, 'a', w);

    statements.a = [];
    const r = await syncWindow(ctx, 'a', w);
    expect(r).toMatchObject({ cancelledHolds: 1, missingNonHolds: 1 });
    expect(await txRows()).toMatchObject([
      { id: 'h1', cancelled: 1 },
      { id: 'p1', cancelled: 0 },
    ]);
    expect(warnings.join('\n')).toMatch(/p1.*не холд/);

    statements.a = [item('h1', 1500, -10_000, { hold: true })];
    await syncWindow(ctx, 'a', w);
    expect((await txRows())[0]).toMatchObject({ id: 'h1', cancelled: 0 });
  });

  it('holds on the window boundary are never cancelled (boundary inclusivity is not stated in the docs)', async () => {
    db = await memoryDb();
    await insertAccount(db, 'a');
    const statements: Record<string, RawItem[]> = { a: [item('edge', 2000, -1, { hold: true })] };
    const { ctx } = makeCtx(fakeMonobank({ statements }));
    await syncWindow(ctx, 'a', { from: 1000, to: 2000 });
    statements.a = [];
    const r = await syncWindow(ctx, 'a', { from: 2000, to: 3000 });
    expect(r.cancelledHolds).toBe(0);
  });

  it('local_date is the Kyiv date, not UTC', async () => {
    db = await memoryDb();
    await insertAccount(db, 'a');
    const t = Date.UTC(2025, 6, 31, 22, 30) / 1000; // 31.07 22:30 UTC = 01.08 01:30 Kyiv (UTC+3)
    const { ctx } = makeCtx(fakeMonobank({ statements: { a: [item('x', t, -1)] } }));
    await syncWindow(ctx, 'a', { from: t - 10, to: t + 10 });
    expect((await txRows())[0]?.localDate).toBe('2025-08-01');
  });
});

describe('resumability', () => {
  it('failure in the 3rd window keeps the first two; next run resumes from the covered edge', async () => {
    db = await memoryDb();
    const clock = fakeClock();
    const now = Math.floor(clock.nowMs() / 1000);
    const since = now - 4 * WINDOW_SEC + 100; // → 4 windows
    const items = Array.from({ length: 40 }, (_, i) => item(`t${i}`, since + i * Math.floor((now - since) / 40), -100));
    let fail = true;
    const mono = fakeMonobank({
      accounts: [{ id: 'a' }],
      statements: { a: items },
      intercept: (i) => (fail && i === 3 ? 'throw' : undefined), // 0 = client-info, 1..2 = windows 1..2, 3 = window 3
    });
    const { ctx } = makeCtx(mono, clock);
    await syncAccounts(ctx);

    const plan1 = await planHistory(ctx, { sinceSec: since });
    expect(plan1.get('a')).toHaveLength(4);
    await expect(runPlan(ctx, plan1)).rejects.toThrow();

    const state = await getSyncState(db, 'a');
    // windows are aligned to `since`: [since + 3W, now], [since + 2W, since + 3W], …
    expect(state).toMatchObject({ newest: now, oldest: since + 2 * WINDOW_SEC });

    fail = false;
    const plan2 = await planHistory(ctx, { sinceSec: since });
    const ws = plan2.get('a') ?? [];
    // forward refresh (last 3 days) + the 2 remaining backward windows; nothing already covered is re-fetched except the overlap
    const now2 = Math.floor(clock.nowMs() / 1000); // the clock moved on while waiting for the rate limit
    expect(ws[0]).toEqual({ from: now - RESYNC_OVERLAP_SEC, to: now2 });
    expect(ws.slice(1)).toEqual([
      { from: since + WINDOW_SEC, to: since + 2 * WINDOW_SEC },
      { from: since, to: since + WINDOW_SEC },
    ]);
    await runPlan(ctx, plan2);
    expect(await getSyncState(db, 'a')).toMatchObject({ oldest: since, newest: now2 });
    expect(await txRows()).toHaveLength(40);
  });

  it('commitWindow refuses a window that would leave a hole', async () => {
    db = await memoryDb();
    await insertAccount(db, 'a');
    const { ctx } = makeCtx(fakeMonobank({}));
    await commitWindow(ctx, 'a', { from: 1000, to: 2000 }, []);
    await expect(commitWindow(ctx, 'a', { from: 5000, to: 6000 }, [])).rejects.toThrow(/дыру/);
    await commitWindow(ctx, 'a', { from: 2000, to: 3000 }, []);
    expect(await getSyncState(db, 'a')).toMatchObject({ oldest: 1000, newest: 3000 });
  });
});

describe('syncRecent (MCP, never blocks)', () => {
  it('syncs the stalest account, reports the rest as rate-limited / not-imported / needs-full-sync', async () => {
    db = await memoryDb();
    const clock = fakeClock();
    const now = Math.floor(clock.nowMs() / 1000);
    for (const id of ['fresh', 'stale', 'new', 'old']) await insertAccount(db, id);
    const setState = (id: string, oldest: number, newest: number, last: number) =>
      db.execute({
        sql: 'INSERT INTO sync_state VALUES (?, ?, ?, ?)',
        args: [id, oldest, newest, last],
      });
    await setState('fresh', now - 60 * DAY, now - DAY, now - DAY);
    await setState('stale', now - 60 * DAY, now - 2 * DAY, now - 2 * DAY);
    await setState('old', now - 90 * DAY, now - 60 * DAY, now - 60 * DAY);

    const mono = fakeMonobank({ statements: { stale: [item('s1', now - 3600, -100)] } });
    const { ctx } = makeCtx(mono, clock, 'fail');
    const res = await syncRecent(ctx);

    expect(res).toEqual(
      expect.arrayContaining([
        { accountId: 'new', status: 'not-imported' },
        { accountId: 'old', status: 'needs-full-sync', windows: 3 },
        expect.objectContaining({ accountId: 'stale', status: 'synced' }),
        { accountId: 'fresh', status: 'rate-limited', retryAfterSec: 60 },
      ]),
    );
    expect(mono.calls).toHaveLength(1);
    expect(await getSyncState(db, 'stale')).toMatchObject({ newest: now });
  });
});

describe('optional fields & format errors', () => {
  it('a minimal transaction is stored with NULLs for absent fields (no guessed values)', async () => {
    db = await memoryDb();
    await insertAccount(db, 'a');
    const minimal = { id: 'm1', time: 1500, amount: -500, currencyCode: 980, hold: false, mcc: 5411 };
    const mono = fakeMonobank({ intercept: () => Response.json([minimal]) });
    const { ctx } = makeCtx(mono);
    await syncWindow(ctx, 'a', { from: 1000, to: 2000 });
    const rs = await db.execute('SELECT description, operation_amount, balance, commission_rate, cashback_amount FROM transactions');
    expect(rs.rows[0]).toMatchObject({
      description: '', operation_amount: null, balance: null, commission_rate: null, cashback_amount: null,
    });
  });

  it('format error → log line with field + tx id + account + window number; window not saved', async () => {
    db = await memoryDb();
    const clock = fakeClock();
    const now = Math.floor(clock.nowMs() / 1000);
    let call = 0;
    const mono = fakeMonobank({
      accounts: [{ id: 'a' }],
      intercept: (_i, url) => {
        if (!url.includes('/statement/')) return undefined;
        call++;
        return call === 2
          ? Response.json([{ id: 'bad-1', time: now - 40 * DAY, amount: -777, currencyCode: 980, hold: 'no', mcc: 5411, description: 'SECRET' }])
          : Response.json([]);
      },
    });
    const { ctx } = makeCtx(mono, clock);
    await syncAccounts(ctx);
    const err = await runPlan(ctx, await planHistory(ctx, { sinceSec: now - 50 * DAY })).catch((e: unknown) => e);
    const msg = (err as Error).message;
    expect(msg).toMatch(/поля \[hold\]/);
    expect(msg).toContain('bad-1');
    expect(msg).toContain('счёт a');
    expect(msg).toMatch(/окно 2\/2/);
    for (const leak of ['777', 'SECRET']) expect(msg).not.toContain(leak);
    expect(await getSyncState(db, 'a')).toMatchObject({ newest: now }); // window 1 kept, window 2 not
    expect((await getSyncState(db, 'a'))?.oldest).toBeGreaterThan(now - 50 * DAY);
  });
});

describe('default account selection', () => {
  it('all cards + jars with balance > 0 OR already tracked; explicit accountIds override', async () => {
    db = await memoryDb();
    const mono = fakeMonobank({
      accounts: [{ id: 'card1' }],
      jars: [
        { id: 'jarFull', title: 'Відпустка', balance: 1000 },
        { id: 'jarEmptied', title: 'Була повна', balance: 0 },
        { id: 'jarEmpty', title: 'Стара', balance: 0 },
      ],
    });
    const { ctx } = makeCtx(mono);
    await syncAccounts(ctx);
    // jarEmptied was imported earlier (has sync_state) and is now empty — it must stay in scope
    await db.execute({ sql: 'INSERT INTO sync_state VALUES (?, 1, 2, 2)', args: ['jarEmptied'] });

    expect(await defaultAccountSelection(db)).toEqual({
      selected: ['card1', 'jarEmptied', 'jarFull'],
      skippedJars: [{ id: 'jarEmpty', title: 'Стара' }],
    });
    const now = Math.floor(ctx.clock.nowMs() / 1000);
    expect([...(await planHistory(ctx, { sinceSec: now - DAY })).keys()]).toEqual(['card1', 'jarEmptied', 'jarFull']);
    expect([...(await planHistory(ctx, { sinceSec: now - DAY, accountIds: ['jarEmpty'] })).keys()]).toEqual(['jarEmpty']);
  });
});

describe('secrets', () => {
  it('the token never ends up in the DB', async () => {
    db = await memoryDb();
    const clock = fakeClock();
    const now = Math.floor(clock.nowMs() / 1000);
    const mono = fakeMonobank({ accounts: [{ id: 'a' }], jars: [{ id: 'j' }], statements: { a: [item('t', now - 100, -1)] } });
    const { ctx } = makeCtx(mono, clock);
    await syncAccounts(ctx);
    await runPlan(ctx, await planHistory(ctx, { sinceSec: now - DAY }));
    expect(await allTextInDb(db)).not.toContain(TEST_TOKEN);
  });
});
