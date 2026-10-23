// Incremental derivation equals a full pass: a two-connection import window by window (each window's own pass), an
// account turned off half way, the end-of-import pass over the touched spans, then a statement upload to a file
// connection — and a full rederiveCore afterwards moves no derived value. Then two banks: a second, fictional bank
// (added to the registries by mocks only, it borrows Monobank's rules and API facts) whose statement uploads pair with
// Monobank's windows across banks, before and after them. Fictional data only.
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setAccountEnabled } from '../../src/commands/people.ts';
import type { Db } from '../../src/storage/db.ts';
import { accountInputs, accountInputsChanged } from '../../src/derive/derived.ts';
import { addConnection, addParticipant } from '../../src/people/participants.ts';
import { createMonoClient } from '../../src/providers/monobank/client.ts';
import { monobankCardReader } from '../../src/providers/monobank/statement.ts';
import { rederiveCore, rederiveSpans } from '../../src/derive/rederive.ts';
import { commitStatement } from '../../src/ingest/statement-import.ts';
import { WINDOW_SEC, interleavePlan } from '../../src/ingest/plan.ts';
import { planHistory, syncAccounts, syncWindow, type SyncContext } from '../../src/ingest/sync.ts';
import { CROSS_BANK_WINDOW_SEC, type TimeRange } from '../../src/derive/transfers.ts';
import type { ParsedStatement, ProviderId, ProviderInfo } from '../../src/providers/types.ts';
import { TEST_TOKEN, derivedColumns, fakeClock, fakeMonobank, item, memoryDb, testConnection, type RawItem } from '../helpers.ts';

vi.mock('../../src/providers/types.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/providers/types.ts')>()),
  PROVIDER_IDS: ['monobank', 'fictional'],
}));
vi.mock('../../src/providers/info.ts', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../src/providers/info.ts')>();
  const providers: Record<string, ProviderInfo> = {
    ...real.PROVIDERS,
    fictional: { ...real.PROVIDERS.monobank, id: 'fictional' as ProviderId, name: 'Fictional Bank', ids: 'prefixed' },
  };
  return { ...real, PROVIDERS: providers, infoOf: (p: string) => providers[p], apiOf: (p: string) => providers[p]?.access.token?.api };
});
vi.mock('../../src/providers/rules.ts', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../src/providers/rules.ts')>();
  return { ...real, rulesFor: (p: string) => real.rulesFor(p === 'fictional' ? 'monobank' : (p as ProviderId)) };
});

const TOKEN_B = 'test-token-B-SHOULD-NEVER-LEAK-77aa';
let db: Db;
afterEach(() => db?.close());

/** A small deterministic generator: the same rows on every run. */
function lcg(seed: number): () => number {
  let s = seed;
  return () => (s = (s * 1_103_515_245 + 12_345) % 2_147_483_648) / 2_147_483_648;
}

describe('incremental derivation equals a full pass', () => {
  it('after windows of two connections, a toggle half way, the span pass and a statement upload', async () => {
    db = await memoryDb();
    const clock = fakeClock();
    const now = Math.floor(clock.nowMs() / 1000);
    const since = now - 3 * WINDOW_SEC + 100;
    const me = await testConnection(db);
    const meParticipant = Number((await db.execute({ sql: 'SELECT participant_id FROM connections WHERE id = ?', args: [me] })).rows[0]?.participant_id);
    const her = await addConnection(db, await addParticipant(db, { label: 'Вигадана Особа' }, 0), 'monobank', 0);

    const statementsA: Record<string, RawItem[]> = {};
    const statementsB: Record<string, RawItem[]> = {};
    const a = fakeMonobank({
      accounts: [{ id: 'a-black', iban: 'UA00FICTIONALA1' }, { id: 'a-white', iban: 'UA00FICTIONALA2' }],
      jars: [{ id: 'a-jar', title: 'Fictional goal', balance: 5000 }],
      clientId: 'holder-a',
      statements: statementsA,
    });
    const b = fakeMonobank({ accounts: [{ id: 'b-black', iban: 'UA00FICTIONALB1' }], clientId: 'holder-b', statements: statementsB });
    const ctxOf = (connectionId: number, token: string, bank: typeof a): SyncContext => ({
      db,
      clock,
      connectionId,
      api: createMonoClient({ token, db, fetch: bank.fetch, clock, rateLimitMode: 'wait', connectionId }),
    });
    const ctxA = ctxOf(me, TEST_TOKEN, a);
    const ctxB = ctxOf(her, TOKEN_B, b);
    await syncAccounts(ctxA);
    await syncAccounts(ctxB);
    const inputs = await accountInputs(db);

    const planA = await planHistory(ctxA, { sinceSec: since });
    const planB = await planHistory(ctxB, { sinceSec: since });
    // Window boundaries of the history: the halves of a transfer land in windows of different accounts or connections.
    const bounds = [...new Set([...planA.values(), ...planB.values()].flat().map((w) => w.from))].filter((t) => t > since).sort();
    expect(bounds.length).toBeGreaterThanOrEqual(2);

    const rnd = lcg(7);
    let n = 0;
    const add = (to: Record<string, RawItem[]>, account: string, time: number, amount: number, extra: Partial<RawItem> = {}) =>
      (to[account] ??= []).push(item(`${account}-${++n}`, time, amount, extra));
    for (let t = since + 600; t < now - 600; t += 3 * 3600 + Math.floor(rnd() * 7200)) {
      add(statementsA, 'a-black', t, -Math.floor(1000 + rnd() * 50_000), { mcc: rnd() < 0.5 ? 5411 : 5812 });
      add(statementsB, 'b-black', t + 77, -Math.floor(1000 + rnd() * 30_000), { mcc: 5411 });
      if (rnd() < 0.2) add(statementsA, 'a-white', t + 133, -Math.floor(500 + rnd() * 9000), { mcc: 5999, commissionRate: 100 });
    }
    const transfer = { mcc: 4829, description: 'Fictional transfer' };
    // An own pair and a family pair straddling window boundaries.
    add(statementsA, 'a-black', bounds[0]! - 5, -7000, transfer);
    add(statementsA, 'a-white', bounds[0]! + 5, 7000, transfer);
    add(statementsA, 'a-black', bounds[1]! - 3, -3000, transfer);
    add(statementsB, 'b-black', bounds[1]! + 4, 3000, transfer);
    // A single row to an own IBAN, and one to the other person's.
    add(statementsA, 'a-white', since + 5000, -2500, { ...transfer, counterIban: 'UA00FICTIONALA1' });
    add(statementsB, 'b-black', since + 9000, -1500, { ...transfer, counterIban: 'UA00FICTIONALA2' });
    // A top-up of the jar named by its title, both sides.
    add(statementsA, 'a-black', now - 20_000, -1000, { mcc: 4829, description: 'Fictional goal' });
    add(statementsA, 'a-jar', now - 19_998, 1000, { mcc: 4829, description: 'Fictional goal' });
    // Purchases refunded soon after (the credit comes as a transfer-coded row), one across a window boundary; a hold.
    add(statementsA, 'a-black', now - 50_000, -4200, { mcc: 5732, description: 'Fictional electronics' });
    add(statementsA, 'a-black', now - 49_900, 4200, { mcc: 4829, description: 'Fictional refund' });
    add(statementsB, 'b-black', bounds[0]! - 200, -6100, { mcc: 5816, description: 'Fictional game' });
    add(statementsB, 'b-black', bounds[0]! + 200, 6100, { mcc: 4829, description: 'Fictional refund' });
    add(statementsB, 'b-black', now - 900, -800, { hold: true });

    // Windows taking turns between the connections, each committed with its own pass; the white card turned off half way.
    const queue = [...interleavePlan(planA).map((p) => [ctxA, p] as const), ...interleavePlan(planB).map((p) => [ctxB, p] as const)].sort(
      (x, y) => x[1].round - y[1].round,
    );
    const spans: TimeRange[] = [];
    for (const [i, [ctx, p]] of queue.entries()) {
      if (i === Math.floor(queue.length / 2)) await setAccountEnabled(db, 'a-white', false);
      const r = await syncWindow(ctx, p.accountId, p.window);
      expect(r.derivationFailed).toBe(false);
      spans.push(r.span);
    }
    expect(accountInputsChanged(inputs, await accountInputs(db))).toBe(false);
    await rederiveSpans(db, spans);

    const file = await addConnection(db, meParticipant, 'monobank', 0, 'file');
    const parsed = monobankCardReader.read({ format: 'text', text: readFileSync(new URL('../providers/monobank/fixtures/statement-card-uk.csv', import.meta.url), 'utf8') });
    if (!parsed.ok) throw new Error(parsed.problem);
    await commitStatement(db, file, parsed.statements, [{ kind: 'new', id: 'file-card', type: 'black' }], now);

    // The scenario has what it is meant to test.
    const stored = await derivedColumns(db);
    const rules = new Set(stored.map((r) => r.transfer_rule).filter((x) => x !== null));
    for (const rule of ['pair', 'family', 'iban']) expect(rules, rule).toContain(rule);
    expect(stored.some((r) => r.crossing_category !== null)).toBe(true);
    expect(stored.some((r) => r.refund_pair_id !== null)).toBe(true);
    expect(stored.filter((r) => String(r.id).startsWith('file-card')).length).toBeGreaterThan(0);

    await rederiveCore(db);
    expect(await derivedColumns(db)).toEqual(stored);
  });

  it('two banks: statement uploads of another bank pair with Monobank windows, before and after them', async () => {
    db = await memoryDb();
    const clock = fakeClock();
    const now = Math.floor(clock.nowMs() / 1000);
    const since = now - 3 * WINDOW_SEC + 100;
    const me = await testConnection(db);
    const meParticipant = Number((await db.execute({ sql: 'SELECT participant_id FROM connections WHERE id = ?', args: [me] })).rows[0]?.participant_id);
    const her = await addParticipant(db, { label: 'Вигадана Особа' }, 0);
    const statements: Record<string, RawItem[]> = {};
    const mono = fakeMonobank({ accounts: [{ id: 'm-black', iban: 'UA00FICTIONALM1' }], clientId: 'holder-m', statements });
    const ctx: SyncContext = { db, clock, connectionId: me, api: createMonoClient({ token: TEST_TOKEN, db, fetch: mono.fetch, clock, rateLimitMode: 'wait', connectionId: me }) };
    await syncAccounts(ctx);
    const plan = await planHistory(ctx, { sinceSec: since });
    const bounds = [...new Set([...plan.values()].flat().map((w) => w.from))].filter((t) => t > since).sort();
    expect(bounds.length).toBeGreaterThanOrEqual(2);

    const FICTIONAL = 'fictional' as ProviderId;
    const mine = await addConnection(db, meParticipant, FICTIONAL, 0, 'file');
    const hers = await addConnection(db, her, FICTIONAL, 0, 'file');
    const transfer = { mcc: 4829, description: 'Fictional transfer' };
    const fileRow = (time: number, amount: number) => ({ time, amount, currencyCode: 980, hold: false, ...transfer, raw: '{}' });
    const fileOf = (rows: ReturnType<typeof fileRow>[]): ParsedStatement => ({
      kind: 'card', currencyCode: 980, account: { iban: null, cards: [], type: null }, rows: [...rows].sort((x, y) => x.time - y.time), closingBalance: null,
    });

    const rnd = lcg(11);
    let n = 0;
    const monoRow = (time: number, amount: number, extra: Partial<RawItem> = {}) => (statements['m-black'] ??= []).push(item(`m-${++n}`, time, amount, extra));
    const mineRows: ReturnType<typeof fileRow>[] = [];
    const hersRows: ReturnType<typeof fileRow>[] = [];
    for (let t = since + 900; t < now - 900; t += 5 * 3600 + Math.floor(rnd() * 7200)) {
      monoRow(t, -Math.floor(1000 + rnd() * 40_000), { mcc: 5411 });
      // Monobank → the other bank, 1–3 minutes later, up to a 4% fee; and back, exact.
      const credit = Math.floor(2000 + rnd() * 50_000);
      monoRow(t + 600, -(credit + Math.floor((credit * Math.floor(rnd() * 5)) / 100)), transfer);
      mineRows.push(fileRow(t + 600 + 60 + Math.floor(rnd() * 120), credit));
      mineRows.push(fileRow(t + 1800, -credit));
      monoRow(t + 1800 + 30 + Math.floor(rnd() * 100), credit, transfer);
    }
    // Pairs that straddle a window boundary by more than the same-bank window, and a family one with a fee.
    monoRow(bounds[0]! - 40, -5150, transfer);
    mineRows.push(fileRow(bounds[0]! + CROSS_BANK_WINDOW_SEC - 50, 5000));
    mineRows.push(fileRow(bounds[1]! - 60, -8000));
    monoRow(bounds[1]! + 100, 8000, transfer);
    monoRow(bounds[1]! + 2000, -10_400, transfer);
    hersRows.push(fileRow(bounds[1]! + 2100, 10_000));

    // Half of her bank's rows come before the Monobank windows, all of them after.
    const half = mineRows.filter((r) => r.time < bounds[1]!);
    await commitStatement(db, mine, [fileOf(half)], [{ kind: 'new', id: 'file-mine', type: null }], now);
    const spans: TimeRange[] = [];
    for (const p of interleavePlan(plan)) {
      const r = await syncWindow(ctx, p.accountId, p.window);
      expect(r.derivationFailed).toBe(false);
      spans.push(r.span);
    }
    await rederiveSpans(db, spans);
    await commitStatement(db, mine, [fileOf(mineRows)], [{ kind: 'account', accountId: 'fictional:file-mine' }], now);
    await commitStatement(db, hers, [fileOf(hersRows)], [{ kind: 'new', id: 'file-hers', type: null }], now);

    const stored = await derivedColumns(db);
    const cross = stored.filter((r) => String(r.id).startsWith('m-') && String(r.transfer_pair_id ?? '').startsWith('fictional:'));
    expect(cross.length).toBeGreaterThan(10);
    expect(cross.some((r) => r.transfer_rule === 'pair_fee' && Number(r.transfer_fee) > 0)).toBe(true);
    expect(cross.some((r) => r.transfer_rule === 'pair')).toBe(true);
    expect(cross.some((r) => r.transfer_rule === 'family' && Number(r.transfer_fee) === 400)).toBe(true);

    await rederiveCore(db);
    expect(await derivedColumns(db)).toEqual(stored);
  });
});
