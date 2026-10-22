// Incremental derivation equals a full pass: a two-connection import window by window (each window's own pass), an
// account turned off half way, the end-of-import pass over the touched spans, then a statement upload to a file
// connection — and a full rederiveCore afterwards moves no derived value. Fictional data only.
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
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
import type { TimeRange } from '../../src/derive/transfers.ts';
import { TEST_TOKEN, derivedColumns, fakeClock, fakeMonobank, item, memoryDb, testConnection, type RawItem } from '../helpers.ts';

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
});
