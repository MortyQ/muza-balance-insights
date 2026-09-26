// The worker's import on a mock Monobank: order, progress, cancel, errors — and the token never in a message or the DB.
// Several connections: one job, windows taking turns, a rejected token stops only its connection.
import { describe, expect, it } from 'vitest';
import type { Db } from '@mono/core/db';
import { SyncCancelledError } from '@mono/core/cancel';
import { ConnectionDuplicateError, ConnectionMismatchError, WINDOW_SEC, getSyncState } from '@mono/core/sync';
import { addConnection, addParticipant } from '@mono/core/participants';
import { TEST_TOKEN, allTextInDb, fakeClock, fakeMonobank, item, memoryDb, testConnection } from '@mono/core/test-helpers';
import { FromWorker } from '../src/shared/import-protocol.ts';
import { RETRY_BUDGET_MS, RETRY_EVERY_MS, RETRY_FIRST_MS, SLEEP_TOLERANCE_MS, sleptDuringPause } from '../src/shared/retry.ts';
import { describeError, errorTag, isConnectionFailure, runImport, transientReason } from '../src/worker/run-import.ts';
import { MonoApiError, RateLimitError } from '@mono/core/providers/monobank/client';

async function setup(opts: { intercept?: (i: number, url: string) => Response | 'throw' | undefined } = {}) {
  const db: Db = await memoryDb();
  const clock = fakeClock();
  const now = Math.floor(clock.nowMs() / 1000);
  const since = now - 3 * WINDOW_SEC + 100; // 3 windows per account
  const spread = (acc: string) => Array.from({ length: 4 }, (_, i) => item(`${acc}-${i}`, since + 60 + i * Math.floor((now - since - 120) / 4), -100));
  const mono = fakeMonobank({
    accounts: [{ id: 'cardA', currencyCode: 980 }, { id: 'cardB', currencyCode: 840 }],
    statements: { cardA: spread('a'), cardB: spread('b') },
    ...(opts.intercept ? { intercept: opts.intercept } : {}),
  });
  const messages: FromWorker[] = [];
  const controller = new AbortController();
  const connectionId = await testConnection(db);
  const run = () =>
    runImport({
      db,
      fetchFor: () => mono.fetch,
      clock,
      connections: [{ connectionId, provider: 'monobank', token: TEST_TOKEN }],
      sinceSec: since,
      signal: controller.signal,
      emit: (m) => messages.push(m),
    });
  return { db, mono, messages, controller, run, since, clock };
}

describe('runImport', () => {
  it('accounts → windows round-robin (freshest first) → rederive → done; every message passes the protocol schema', async () => {
    const { db, messages, run, since } = await setup();
    await run();
    for (const m of messages) expect(() => FromWorker.parse(m)).not.toThrow();

    const phases = messages.filter((m) => m.type === 'progress').map((m) => (m.type === 'progress' ? m.progress.phase : ''));
    expect(phases[0]).toBe('accounts');
    expect(phases.at(-1)).toBe('rederive');
    expect(messages.at(-1)).toEqual({ type: 'done', windowsTotal: 6, transactions: 8, failed: [] });

    // Windows in the order they were started (several progress messages per window: start, waits, done).
    const windows = messages.flatMap((m) => (m.type === 'progress' && m.progress.phase === 'windows' ? [m.progress] : []));
    const started: Array<[string, number]> = [];
    for (const p of windows) if (!started.some(([a, r]) => a === p.account && r === p.round)) started.push([p.account, p.round]);
    // Round 1 = both accounts' freshest window, labelled by type/currency — never an id or card number.
    expect(started).toEqual([
      ['black/UAH', 1],
      ['black/USD', 1],
      ['black/UAH', 2],
      ['black/USD', 2],
      ['black/UAH', 3],
      ['black/USD', 3],
    ]);
    for (const acc of ['cardA', 'cardB']) expect(await getSyncState(db, acc)).toMatchObject({ oldest: since });
    db.close();
  });

  it('progress: windowsDone grows to the total, ETA = remaining windows × 60 s, waits show up as waitingSec', async () => {
    const { db, messages, run } = await setup();
    await run();
    const windows = messages.flatMap((m) => (m.type === 'progress' && m.progress.phase === 'windows' ? [m.progress] : []));
    const last = windows.at(-1)!;
    expect(last).toMatchObject({ windowsDone: 6, windowsTotal: 6, transactions: 8, etaSec: 0 });
    for (const p of windows) if (p.waitingSec === null) expect(p.etaSec).toBe((p.windowsTotal - p.windowsDone) * 60);
    expect(windows.some((p) => p.waitingSec !== null && p.waitingSec > 0)).toBe(true); // the 60 s limit between requests
    db.close();
  });

  it('the token is in no message and nowhere in the database', async () => {
    const { db, messages, run } = await setup();
    await run();
    expect(JSON.stringify(messages)).not.toContain(TEST_TOKEN);
    expect(await allTextInDb(db)).not.toContain(TEST_TOKEN);
    db.close();
  });

  it('cancel after the first window: error kind "cancelled", no done; the committed window stays', async () => {
    const { db, messages, controller, run } = await setup();
    const emit = messages.push.bind(messages);
    messages.push = (...m: FromWorker[]) => {
      const r = emit(...m);
      if (m.some((x) => x.type === 'progress' && x.progress.phase === 'windows' && x.progress.windowsDone === 1)) controller.abort();
      return r;
    };
    await run();
    expect(messages.at(-1)).toEqual({ type: 'error', kind: 'cancelled', message: 'Импорт остановлен' });
    expect(messages.some((m) => m.type === 'done')).toBe(false);
    expect(Number((await db.execute('SELECT COUNT(*) AS n FROM transactions')).rows[0]?.n)).toBeGreaterThan(0);
    db.close();
  });

  it('Monobank 401 → "auth" with a fixed text, no retry, no token echoed', async () => {
    const a = await setup({ intercept: (i) => (i === 0 ? Response.json({ errorDescription: `Unknown 'X-Token' ${TEST_TOKEN}` }, { status: 401 }) : undefined) });
    await a.run();
    expect(a.messages.find((m) => m.type === 'error')).toEqual({ type: 'error', kind: 'auth', message: 'Monobank не принял токен. Проверь токен и введи его заново.' });
    expect(a.messages.some((m) => m.type === 'progress' && m.progress.phase === 'retry')).toBe(false);
    expect(JSON.stringify(a.messages)).not.toContain(TEST_TOKEN);
    a.db.close();
  });

  it('the log line comes before the final error (main closes the worker on the final message)', async () => {
    const a = await setup({ intercept: (i) => (i === 0 ? Response.json({}, { status: 401 }) : undefined) });
    await a.run();
    expect(a.messages.slice(-2)).toEqual([
      { type: 'log', message: expect.stringMatching(/^connection \d+ stopped: MonoApiError status=401$/) },
      expect.objectContaining({ type: 'error', kind: 'auth' }),
    ]);
    a.db.close();
  });
});

const statement = (url: string) => url.includes('/personal/statement/');
const retries = (ms: FromWorker[]) => ms.flatMap((m) => (m.type === 'progress' && m.progress.phase === 'retry' ? [m.progress] : []));

describe('runImport: transient failures are waited out (overnight import)', () => {
  it('a network failure mid-import → retry in 1 min → continues from the missing window → done, nothing downloaded twice', async () => {
    let failed = false;
    const { db, messages, run, mono } = await setup({
      intercept: (_, url) => {
        // The third statement request fails once (round 2 of the first account).
        if (statement(url) && !failed && mono.calls.filter((c) => statement(c.url)).length === 3) return (failed = true), 'throw';
        return undefined;
      },
    });
    await run();
    expect(retries(messages)).toEqual([{ phase: 'retry', reason: 'network', attempt: 1, inSec: RETRY_FIRST_MS / 1000 }]);
    expect(messages).toContainEqual({ type: 'log', message: `retry 1: MonoApiError status=none, next in ${RETRY_FIRST_MS / 1000} s` });
    expect(messages.at(-1)).toEqual({ type: 'done', windowsTotal: 6, transactions: 8, failed: [] });
    // 6 windows + one failed attempt; accounts fetched once.
    expect(mono.calls.filter((c) => statement(c.url))).toHaveLength(7);
    expect(mono.calls.filter((c) => c.url.includes('client-info'))).toHaveLength(1);
    const windows = messages.flatMap((m) => (m.type === 'progress' && m.progress.phase === 'windows' ? [m.progress] : []));
    expect(windows.at(-1)).toMatchObject({ windowsDone: 6, windowsTotal: 6 });
    db.close();
  });

  it('Monobank 502 → reason "server"; the accounts request failing is retried too', async () => {
    const s = await setup({ intercept: (i, url) => (statement(url) && i <= 2 ? new Response('bad gateway', { status: 502 }) : undefined) });
    await s.run();
    expect(retries(s.messages).map((r) => r.reason)).toContain('server');
    expect(s.messages.at(-1)).toMatchObject({ type: 'done' });
    s.db.close();

    const a = await setup({ intercept: (i) => (i === 0 ? 'throw' : undefined) });
    await a.run();
    expect(retries(a.messages)).toHaveLength(1);
    expect(a.messages.at(-1)).toMatchObject({ type: 'done', windowsTotal: 6 });
    a.db.close();
  });

  it('down for good: 1 min, then every 15 min, gives up after 4 hours with the real reason on screen', async () => {
    const { db, messages, run, clock } = await setup({ intercept: (_, url) => (statement(url) ? 'throw' : undefined) });
    await run();
    const r = retries(messages);
    expect(r[0]).toMatchObject({ attempt: 1, inSec: 60 });
    expect(r.slice(1).every((x) => x.inSec === RETRY_EVERY_MS / 1000)).toBe(true);
    expect(r.map((x) => x.attempt)).toEqual(r.map((_, i) => i + 1));
    const waited = r.reduce((n, x) => n + x.inSec * 1000, 0);
    expect(waited).toBeLessThanOrEqual(RETRY_BUDGET_MS);
    expect(waited + RETRY_EVERY_MS).toBeGreaterThan(RETRY_BUDGET_MS - 5 * 60_000); // ≈ the whole budget was used
    expect(messages.at(-1)).toEqual({ type: 'error', kind: 'network', message: 'Нет связи с Monobank. Импорт продолжится со следующего запуска.' });
    expect(clock.sleeps.length).toBeGreaterThan(r.length); // retries plus the usual 60 s limit waits
    db.close();
  });

  it('the Mac asleep during a retry pause: that time is not counted, as many retries as when awake', async () => {
    const count = async (sleepMs: number) => {
      const a = await setup({ intercept: (_, url) => (statement(url) ? 'throw' : undefined) });
      const sleep = a.clock.sleep;
      let pauses = 0;
      a.clock.sleep = async (ms, signal) => {
        await sleep(ms, signal);
        if (ms === RETRY_EVERY_MS && ++pauses === 2) a.clock.advance(sleepMs); // woke up hours later
      };
      await a.run();
      a.db.close();
      return { n: retries(a.messages).length, logs: a.messages.filter((m) => m.type === 'log').map((m) => m.message) };
    };
    const awake = await count(0);
    const asleep = await count(3 * 3600_000);
    expect(asleep.n).toBe(awake.n);
    expect(asleep.logs).toContain('retry: computer slept ~180 min, not counted');
    expect(awake.logs.some((l) => l.includes('slept'))).toBe(false);
  });

  it('sleptDuringPause: only an overrun beyond the tolerance counts as sleep', () => {
    expect(sleptDuringPause(0, 60_000, 60_000)).toBe(0);
    expect(sleptDuringPause(0, 60_000 + SLEEP_TOLERANCE_MS, 60_000)).toBe(0);
    expect(sleptDuringPause(0, 60_000 + SLEEP_TOLERANCE_MS + 1, 60_000)).toBe(SLEEP_TOLERANCE_MS + 1);
    expect(sleptDuringPause(0, 30_000, 60_000)).toBe(0);
  });

  it('a committed window resets the streak: a later failure starts again from 1 min', async () => {
    let n = 0;
    const { db, messages, run } = await setup({
      intercept: (_, url) => {
        if (!statement(url)) return undefined;
        n += 1;
        return n === 1 || n === 4 ? 'throw' : undefined; // fail, ok, ok, fail, …
      },
    });
    await run();
    expect(retries(messages).map((r) => [r.attempt, r.inSec])).toEqual([
      [1, 60],
      [1, 60],
    ]);
    expect(messages.at(-1)).toMatchObject({ type: 'done' });
    db.close();
  });

  it('«Остановить» during a retry pause → cancelled at once', async () => {
    const { db, messages, controller, run } = await setup({ intercept: (_, url) => (statement(url) ? 'throw' : undefined) });
    const emit = messages.push.bind(messages);
    messages.push = (...m: FromWorker[]) => {
      const r = emit(...m);
      if (m.some((x) => x.type === 'progress' && x.progress.phase === 'retry')) controller.abort();
      return r;
    };
    await run();
    expect(retries(messages)).toHaveLength(1);
    expect(messages.at(-1)).toEqual({ type: 'error', kind: 'cancelled', message: 'Импорт остановлен' });
    db.close();
  });

  it('what counts as transient: network, 5xx, 429 — not 401/403/4xx, not a format error, not a cancel', () => {
    expect(transientReason(new MonoApiError('x', null))).toBe('network');
    expect(transientReason(new MonoApiError('x', 503))).toBe('server');
    expect(transientReason(new RateLimitError(60, 'server', 'Monobank', 60))).toBe('rate-limit');
    for (const s of [400, 401, 403, 404]) expect(transientReason(new MonoApiError('x', s))).toBeNull();
    expect(transientReason(new Error('Неожиданный формат ответа API: …'))).toBeNull();
    expect(errorTag(new MonoApiError(`Monobank ответил 500: ${TEST_TOKEN}`, 500))).toBe('MonoApiError status=500');
  });

  it('every retry message passes the protocol schema', async () => {
    const { db, messages, run } = await setup({ intercept: (i) => (i === 1 ? 'throw' : undefined) });
    await run();
    for (const m of messages) expect(() => FromWorker.parse(m)).not.toThrow();
    db.close();
  });

  it('an unknown error becomes a generic text; only its name goes to the log', () => {
    expect(describeError(new Error(`boom ${TEST_TOKEN} /Users/x/secret`))).toEqual({
      kind: 'other',
      message: 'Импорт остановился из-за ошибки. Он продолжится со следующего запуска.',
    });
  });
});

describe('runImport: several connections', () => {
  const TOKEN_B = 'test-token-B-SHOULD-NEVER-LEAK-4c1d';
  const CANARY_NAME = 'Канарейка Вигаданенко';

  async function two(opts: { bIntercept?: (url: string) => Response | 'throw' | undefined; bClientId?: string } = {}) {
    const db: Db = await memoryDb();
    const clock = fakeClock();
    const now = Math.floor(clock.nowMs() / 1000);
    const since = now - 2 * WINDOW_SEC + 100; // 2 windows per account
    const me = await testConnection(db);
    const her = await addConnection(db, await addParticipant(db, { fromBank: true }, 0), 'monobank', 0);
    const a = fakeMonobank({ accounts: [{ id: 'mine' }], clientId: 'holder-a', statements: { mine: [item('m1', now - 500, -100)] } });
    const b = fakeMonobank({
      accounts: [{ id: 'hers', currencyCode: 840 }],
      clientId: opts.bClientId ?? 'holder-b',
      name: CANARY_NAME,
      statements: { hers: [item('h1', now - 600, -200)] },
      ...(opts.bIntercept ? { intercept: (_: number, url: string) => opts.bIntercept!(url) } : {}),
    });
    // One provider, two credentials: the bank tells them apart by the token.
    const byToken: typeof fetch = (input, init) => (new Headers(init?.headers).get('X-Token') === TOKEN_B ? b : a).fetch(input, init);
    const messages: FromWorker[] = [];
    await runImport({
      db,
      fetchFor: () => byToken,
      clock,
      connections: [
        { connectionId: me, provider: 'monobank', token: TEST_TOKEN },
        { connectionId: her, provider: 'monobank', token: TOKEN_B },
      ],
      sinceSec: since,
      signal: new AbortController().signal,
      emit: (m) => messages.push(m),
    });
    return { db, messages, a, b, me, her, clock };
  }

  it('both import in one job, windows taking turns; each token only on its own requests; no token or name in any message', async () => {
    const { db, messages, a, b } = await two();
    for (const m of messages) expect(() => FromWorker.parse(m)).not.toThrow();
    expect(messages.at(-1)).toEqual({ type: 'done', windowsTotal: 4, transactions: 2, failed: [] });
    const windows = messages.flatMap((m) => (m.type === 'progress' && m.progress.phase === 'windows' ? [m.progress] : []));
    const started: string[] = [];
    for (const p of windows) if (!started.includes(`${p.account} ${p.round}`)) started.push(`${p.account} ${p.round}`);
    expect(started).toEqual(['black/UAH 1', 'black/USD 1', 'black/UAH 2', 'black/USD 2']);
    expect(a.calls.every((c) => c.token === TEST_TOKEN)).toBe(true);
    expect(b.calls.every((c) => c.token === TOKEN_B)).toBe(true);
    expect((await db.execute('SELECT id FROM transactions ORDER BY id')).rows.map((r) => r.id)).toEqual(['h1', 'm1']);
    const text = JSON.stringify(messages);
    for (const secret of [TEST_TOKEN, TOKEN_B, CANARY_NAME, 'Канарейка']) expect(text).not.toContain(secret);
    expect(await allTextInDb(db)).not.toContain(TOKEN_B);
    db.close();
  });

  it("parallel slots: the ETA is the connection with the most windows left, not the sum", async () => {
    const { db, messages } = await two();
    const first = messages.flatMap((m) => (m.type === 'progress' && m.progress.phase === 'windows' && m.progress.waitingSec === null ? [m.progress] : []))[0]!;
    expect(first).toMatchObject({ windowsDone: 0, windowsTotal: 4, etaSec: 2 * 60 });
    db.close();
  });

  it('a rejected token stops only its connection: the other is imported, done lists the failure', async () => {
    const { db, messages, her } = await two({ bIntercept: () => Response.json({ errorDescription: `Unknown 'X-Token' ${TOKEN_B}` }, { status: 401 }) });
    expect(messages.at(-1)).toEqual({
      type: 'done',
      windowsTotal: 2,
      transactions: 1,
      failed: [{ connectionId: her, kind: 'auth', message: 'Monobank не принял токен. Проверь токен и введи его заново.' }],
    });
    expect((await db.execute('SELECT id FROM transactions')).rows.map((r) => r.id)).toEqual(['m1']);
    expect(messages.some((m) => m.type === 'progress' && m.progress.phase === 'retry')).toBe(false);
    expect(JSON.stringify(messages)).not.toContain(TOKEN_B);
    db.close();
  });

  it('a rejected token in the middle of the history: what that connection already imported stays', async () => {
    let n = 0;
    const { db, messages, her } = await two({ bIntercept: (url) => (url.includes('/statement/') && ++n === 2 ? Response.json({}, { status: 403 }) : undefined) });
    expect(messages.at(-1)).toMatchObject({ type: 'done', windowsTotal: 3, failed: [{ connectionId: her, kind: 'auth' }] });
    expect((await db.execute('SELECT id FROM transactions ORDER BY id')).rows.map((r) => r.id)).toEqual(['h1', 'm1']);
    db.close();
  });

  it('the same holder connected twice: the second is refused (kind connection), the first is imported', async () => {
    const { db, messages, her } = await two({ bClientId: 'holder-a' });
    expect(messages.at(-1)).toMatchObject({ type: 'done', failed: [{ connectionId: her, kind: 'connection' }] });
    expect(JSON.stringify(messages)).not.toContain('holder-a');
    db.close();
  });

  it("a network failure is waited out for the whole job; afterwards both finish", async () => {
    let failed = false;
    const { db, messages } = await two({ bIntercept: (url) => (url.includes('/statement/') && !failed ? ((failed = true), 'throw') : undefined) });
    expect(retries(messages)).toHaveLength(1);
    expect(messages.at(-1)).toEqual({ type: 'done', windowsTotal: 4, transactions: 2, failed: [] });
    db.close();
  });

  it('isConnectionFailure: a rejected or foreign credential — not network, 5xx, format or cancel', () => {
    expect(isConnectionFailure(new MonoApiError('x', 401))).toBe(true);
    expect(isConnectionFailure(new MonoApiError('x', 403))).toBe(true);
    expect(isConnectionFailure(new ConnectionMismatchError('x'))).toBe(true);
    expect(isConnectionFailure(new ConnectionDuplicateError('x'))).toBe(true);
    for (const e of [new MonoApiError('x', null), new MonoApiError('x', 502), new Error('Неожиданный формат ответа API: …'), new SyncCancelledError()]) {
      expect(isConnectionFailure(e)).toBe(false);
    }
  });
});
