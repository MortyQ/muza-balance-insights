import { afterEach, describe, expect, it } from 'vitest';
import type { Db } from '../src/db.ts';
import { MonoApiError, RateLimitError, StatementFormatError, createMonoClient } from '../src/monoApi.ts';
import { TEST_TOKEN, fakeClock, fakeMonobank, item, memoryDb } from './helpers.ts';

let db: Db;
afterEach(() => db?.close());

describe('rate limiter (shared via api_calls)', () => {
  it('first call goes immediately, second waits the remaining part of 60 s', async () => {
    db = await memoryDb();
    const clock = fakeClock();
    const mono = fakeMonobank({ accounts: [{ id: 'a' }] });
    const api = createMonoClient({ token: TEST_TOKEN, db, fetch: mono.fetch, clock });

    await api.clientInfo();
    expect(clock.sleeps).toEqual([]);
    clock.advance(15_000);
    await api.statement('a', 0, 100);
    expect(clock.sleeps).toEqual([45_000]);
    expect(mono.calls).toHaveLength(2);
  });

  it('works across two clients on the same DB (CLI + MCP process)', async () => {
    db = await memoryDb();
    const clock = fakeClock();
    const mono = fakeMonobank({});
    const cli = createMonoClient({ token: TEST_TOKEN, db, fetch: mono.fetch, clock, rateLimitMode: 'wait' });
    const mcp = createMonoClient({ token: TEST_TOKEN, db, fetch: mono.fetch, clock, rateLimitMode: 'fail' });

    await cli.clientInfo();
    clock.advance(10_000);
    const err = await mcp.clientInfo().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(RateLimitError);
    expect((err as RateLimitError).retryAfterSec).toBe(50);
    expect((err as RateLimitError).source).toBe('local');
    expect(mono.calls).toHaveLength(1); // the MCP call never hit the network

    clock.advance(50_000);
    await mcp.clientInfo();
    expect(mono.calls).toHaveLength(2);
  });

  it('429 consumes the slot and pushes it forward from the moment of the 429', async () => {
    db = await memoryDb();
    const clock = fakeClock();
    const mono = fakeMonobank({
      intercept: (i) =>
        i === 0 ? Response.json({ errorDescription: 'Too many requests' }, { status: 429, headers: { 'Retry-After': '75' } }) : undefined,
    });
    const api = createMonoClient({ token: TEST_TOKEN, db, fetch: mono.fetch, clock, rateLimitMode: 'fail' });

    const err = await api.clientInfo().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(RateLimitError);
    expect((err as RateLimitError).retryAfterSec).toBe(75);
    expect((err as RateLimitError).source).toBe('server');

    clock.advance(59_000);
    await expect(api.clientInfo()).rejects.toBeInstanceOf(RateLimitError);
    expect(mono.calls).toHaveLength(1); // no blind retry
  });

  it('429 without Retry-After → 60 s', async () => {
    db = await memoryDb();
    const mono = fakeMonobank({ intercept: () => new Response('', { status: 429 }) });
    const api = createMonoClient({ token: TEST_TOKEN, db, fetch: mono.fetch, clock: fakeClock() });
    await expect(api.clientInfo()).rejects.toMatchObject({ retryAfterSec: 60 });
  });

  it('network error also consumes the slot', async () => {
    db = await memoryDb();
    const clock = fakeClock();
    const mono = fakeMonobank({ intercept: (i) => (i === 0 ? 'throw' : undefined) });
    const api = createMonoClient({ token: TEST_TOKEN, db, fetch: mono.fetch, clock, rateLimitMode: 'wait' });

    await expect(api.clientInfo()).rejects.toBeInstanceOf(MonoApiError);
    await api.clientInfo();
    expect(clock.sleeps).toEqual([60_000]);
  });
});

describe('response validation and secrets', () => {
  it('sends the token only in the X-Token header, never in the URL', async () => {
    db = await memoryDb();
    const mono = fakeMonobank({});
    await createMonoClient({ token: TEST_TOKEN, db, fetch: mono.fetch, clock: fakeClock() }).clientInfo();
    expect(mono.calls[0]?.token).toBe(TEST_TOKEN);
    expect(mono.calls[0]?.url).not.toContain(TEST_TOKEN);
  });

  it('error messages never contain the token, even if the server echoes it', async () => {
    db = await memoryDb();
    const mono = fakeMonobank({
      intercept: () => Response.json({ errorDescription: `Unknown 'X-Token': ${TEST_TOKEN}` }, { status: 403 }),
    });
    const err = await createMonoClient({ token: TEST_TOKEN, db, fetch: mono.fetch, clock: fakeClock() })
      .clientInfo()
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(MonoApiError);
    expect((err as Error).message).toContain('403');
    expect((err as Error).message).toContain('Проверь MONO_TOKEN');
    expect((err as Error).message).not.toContain(TEST_TOKEN);
  });

  it('rejects a bad item with field names + transaction id only — no amounts, descriptions, counterparties', async () => {
    db = await memoryDb();
    const bad = { id: 'tx-9', time: 'yesterday', amount: 12345, description: 'SECRET SHOP', counterName: 'Іван Петренко', hold: false, currencyCode: 980 };
    const mono = fakeMonobank({ intercept: () => Response.json([bad]) });
    const err = await createMonoClient({ token: TEST_TOKEN, db, fetch: mono.fetch, clock: fakeClock() })
      .statement('a', 0, 1)
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(StatementFormatError);
    const e = err as StatementFormatError;
    expect(e.fields).toEqual(expect.arrayContaining(['time', 'mcc']));
    expect(e.transactionId).toBe('tx-9');
    for (const leak of ['12345', 'SECRET', 'Іван', 'yesterday']) expect(e.message).not.toContain(leak);
  });

  it('a transaction with only the required fields passes; optional fields are undefined', async () => {
    db = await memoryDb();
    const minimal = { id: 'm1', time: 1000, amount: -500, currencyCode: 980, hold: false, mcc: 5411 };
    const mono = fakeMonobank({ intercept: () => Response.json([minimal]) });
    const [tx] = await createMonoClient({ token: TEST_TOKEN, db, fetch: mono.fetch, clock: fakeClock() }).statement('a', 0, 2000);
    expect(tx).toMatchObject(minimal);
    expect(tx?.operationAmount).toBeUndefined();
    expect(tx?.balance).toBeUndefined();
    expect(tx?.description).toBeUndefined();
  });

  it('each required field is really required', async () => {
    db = await memoryDb();
    const minimal = { id: 'm1', time: 1000, amount: -500, currencyCode: 980, hold: false, mcc: 5411 };
    for (const field of Object.keys(minimal)) {
      const { [field as keyof typeof minimal]: _omit, ...rest } = minimal;
      const mono = fakeMonobank({ intercept: () => Response.json([rest]) });
      const err = await createMonoClient({ token: TEST_TOKEN, db, fetch: mono.fetch, clock: fakeClock() })
        .statement('a', 0, 2000)
        .catch((e: unknown) => e);
      expect(err, field).toBeInstanceOf(StatementFormatError);
      expect((err as StatementFormatError).fields, field).toContain(field);
      await db.execute('DELETE FROM api_calls');
    }
  });

  it('unknown fields are ignored (not .strict()) and the raw JSON is kept', async () => {
    db = await memoryDb();
    const raw = { ...item('t1', 1000, -5000), invoiceId: 'INV-1', unknownFutureField: 42 };
    const mono = fakeMonobank({ intercept: () => Response.json([raw]) });
    const [tx] = await createMonoClient({ token: TEST_TOKEN, db, fetch: mono.fetch, clock: fakeClock() }).statement('a', 0, 2000);
    expect(tx?.amount).toBe(-5000);
    expect(JSON.parse(tx?.raw ?? '{}')).toEqual(raw);
  });
});
