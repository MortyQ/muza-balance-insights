// The end of an import: only the spans its windows touched are re-derived, unless a window's derivation failed or the
// accounts' IBANs or jar titles changed (then a full pass). Separate file: vi.mock wraps the core's rederive module.
// Mock Monobank, fictional data only.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Db } from '@mono/core/storage/db';
import * as rederive from '@mono/core/derive/rederive';
import { WINDOW_SEC } from '@mono/core/sync';
import { TEST_TOKEN, derivedColumns, fakeClock, fakeMonobank, item, memoryDb, testConnection } from '@mono/core/test-helpers';
import type { FromWorker } from '../src/shared/import-protocol.ts';
import { runImport } from '../src/worker/run-import.ts';

const failNext = vi.hoisted(() => ({ value: false }));
vi.mock('@mono/core/derive/rederive', async (importOriginal) => {
  const real = await importOriginal<typeof import('@mono/core/derive/rederive')>();
  return {
    ...real,
    rederiveCore: vi.fn(real.rederiveCore),
    rederiveSpans: vi.fn(real.rederiveSpans),
    deriveSpan: vi.fn(async (...args: Parameters<typeof real.deriveSpan>) => {
      if (failNext.value) {
        failNext.value = false;
        throw new Error('derivation exploded');
      }
      return real.deriveSpan(...args);
    }),
  };
});

let db: Db;
beforeEach(() => {
  failNext.value = false;
});
afterEach(() => db?.close());

type Bank = { accounts: Array<{ id: string; currencyCode?: number }>; jars: Array<{ id: string; title?: string; balance?: number }> };

/** A family's bank that can change between runs; each run re-reads the last window of every account. */
async function bank(initial: Bank) {
  db = await memoryDb();
  const clock = fakeClock();
  const now = Math.floor(clock.nowMs() / 1000);
  const since = now - 2 * WINDOW_SEC + 100;
  const opts: Bank & { statements: Record<string, ReturnType<typeof item>[]> } = {
    ...initial,
    statements: {
      cardA: [item('a-1', since + 60, -100), item('a-2', now - 3600, -250)],
      cardB: [item('b-1', now - 7200, -400)],
    },
  };
  const mono = fakeMonobank(opts);
  const connectionId = await testConnection(db);
  const run = async (): Promise<FromWorker[]> => {
    const messages: FromWorker[] = [];
    vi.mocked(rederive.rederiveCore).mockClear();
    vi.mocked(rederive.rederiveSpans).mockClear();
    await runImport({
      db,
      fetchFor: () => mono.fetch,
      clock,
      connections: [{ connectionId, provider: 'monobank', token: TEST_TOKEN }],
      sinceSec: since,
      rereadWindow: true,
      signal: new AbortController().signal,
      emit: (m) => messages.push(m),
    });
    expect(messages.at(-1)?.type).toBe('done');
    return messages;
  };
  return { opts, run };
}

/** Which end-of-import pass ran, and that the stored values equal a full pass afterwards. */
async function endPass(messages: FromWorker[]): Promise<'spans' | 'full'> {
  const spans = vi.mocked(rederive.rederiveSpans).mock.calls.length;
  const full = vi.mocked(rederive.rederiveCore).mock.calls.length;
  expect(spans + full).toBe(1);
  const log = messages.flatMap((m) => (m.type === 'log' && m.message.startsWith('rederive: ') ? [m.message] : []));
  expect(log).toHaveLength(1);
  const stored = await derivedColumns(db);
  await rederive.rederiveCore(db);
  expect(await derivedColumns(db)).toEqual(stored);
  return spans === 1 ? 'spans' : 'full';
}

describe('runImport: the end-of-import pass', () => {
  it('the first import brings new IBANs: a full pass; the next, routine one: the spans only', async () => {
    const { run } = await bank({ accounts: [{ id: 'cardA' }, { id: 'cardB', currencyCode: 840 }], jars: [] });
    expect(await endPass(await run())).toBe('full');
    const messages = await run();
    expect(await endPass(messages)).toBe('spans');
    expect(messages.some((m) => m.type === 'log' && /^rederive: \d+ spans, categories changed: \d+$/.test(m.message))).toBe(true);
  });

  it('a new account without a new IBAN or jar title: the spans only', async () => {
    const { opts, run } = await bank({ accounts: [{ id: 'cardA' }], jars: [{ id: 'jar1', title: 'Fictional goal', balance: 100 }] });
    await run();
    opts.jars.push({ id: 'jar2', title: 'Fictional goal', balance: 100 });
    expect(await endPass(await run())).toBe('spans');
  });

  it('a new IBAN: a full pass', async () => {
    const { opts, run } = await bank({ accounts: [{ id: 'cardA' }], jars: [] });
    await run();
    opts.accounts.push({ id: 'cardB', currencyCode: 840 });
    expect(await endPass(await run())).toBe('full');
  });

  it('a new jar title: a full pass', async () => {
    const { opts, run } = await bank({ accounts: [{ id: 'cardA' }], jars: [{ id: 'jar1', title: 'Fictional goal', balance: 100 }] });
    await run();
    opts.jars.push({ id: 'jar2', title: 'Fictional trip', balance: 100 });
    expect(await endPass(await run())).toBe('full');
  });

  it("a window whose derivation failed: a full pass, and the log line is the full pass's", async () => {
    const { run } = await bank({ accounts: [{ id: 'cardA' }], jars: [] });
    await run();
    failNext.value = true;
    const messages = await run();
    expect(failNext.value).toBe(false);
    expect(await endPass(messages)).toBe('full');
    expect(messages.some((m) => m.type === 'log' && m.message.startsWith('warn: '))).toBe(true);
  });
});
