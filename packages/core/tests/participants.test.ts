// People and connections (migration v9, participants.ts), the holder's name from the bank, duplicates, several
// connections in one run (runPlans), deleting a connection, balances per participant. Fictional data only.
import { afterEach, describe, expect, it } from 'vitest';
import { ConnectionError } from '../src/connections.ts';
import type { Db } from '../src/db.ts';
import {
  BANK_LABEL_PLACEHOLDER,
  addConnection,
  addParticipant,
  deleteConnection,
  listConnections,
  listParticipants,
  renameParticipant,
} from '../src/participants.ts';
import { MonoApiError, createMonoClient } from '../src/providers/monobank/client.ts';
import { rederiveCore } from '../src/rederive.ts';
import { getBalances } from '../src/status.ts';
import {
  ConnectionDuplicateError,
  WINDOW_SEC,
  planHistory,
  runPlans,
  syncAccounts,
  type SyncContext,
} from '../src/sync.ts';
import { TEST_TOKEN, fakeClock, fakeMonobank, insertAccountRow, item, memoryDb, type FakeClock } from './helpers.ts';

let db: Db;
afterEach(() => db?.close());

const rows = async (sql: string, args: Array<string | number> = []) => (await db.execute({ sql, args })).rows;

type Fake = Parameters<typeof fakeMonobank>[0];

function ctxFor(connectionId: number, fake: Fake, clock: FakeClock = fakeClock()) {
  const warnings: string[] = [];
  const mono = fakeMonobank(fake);
  const api = createMonoClient({ token: TEST_TOKEN, db, fetch: mono.fetch, clock, connectionId });
  const ctx: SyncContext = { db, api, clock, connectionId, warn: (m) => warnings.push(m) };
  return { ctx, warnings, calls: mono.calls };
}

async function person(label: string): Promise<{ participant: number; connection: number }> {
  const participant = await addParticipant(db, { label }, 0);
  return { participant, connection: await addConnection(db, participant, 'monobank', 0) };
}

describe('participants', () => {
  it('v9: a label is typed by the user unless it says bank; only user and bank are allowed', async () => {
    db = await memoryDb();
    await db.execute(`INSERT INTO participants (label, created_at) VALUES ('Вигадана особа', 0)`);
    expect(await rows('SELECT label_source FROM participants')).toEqual([{ label_source: 'user' }]);
    await expect(db.execute(`UPDATE participants SET label_source = 'other'`)).rejects.toThrow(/CHECK/i);
  });

  it('add, list in order, rename; the label is trimmed and checked', async () => {
    db = await memoryDb();
    const a = await addParticipant(db, { label: '  Вигадана   Особа ' }, 0);
    const b = await addParticipant(db, { fromBank: true }, 0);
    expect(await listParticipants(db)).toEqual([
      { id: a, label: 'Вигадана Особа', labelSource: 'user' },
      { id: b, label: BANK_LABEL_PLACEHOLDER, labelSource: 'bank' },
    ]);
    await renameParticipant(db, b, 'Друга');
    expect((await listParticipants(db))[1]).toEqual({ id: b, label: 'Друга', labelSource: 'user' });
    await expect(addParticipant(db, { label: '   ' }, 0)).rejects.toBeInstanceOf(ConnectionError);
    await expect(renameParticipant(db, b, 'x'.repeat(81))).rejects.toBeInstanceOf(ConnectionError);
    await expect(renameParticipant(db, 999, 'Хтось')).rejects.toBeInstanceOf(ConnectionError);
    await expect(addConnection(db, 999, 'monobank', 0)).rejects.toBeInstanceOf(ConnectionError);
  });

  it("«взять имя из банка»: the first import sets the holder's name; after a rename the bank no longer changes it", async () => {
    db = await memoryDb();
    const participant = await addParticipant(db, { fromBank: true }, 0);
    const connection = await addConnection(db, participant, 'monobank', 0);
    await syncAccounts(ctxFor(connection, { accounts: [{ id: 'c1' }], name: ' Вигадана  Банківська ' }).ctx);
    expect((await listParticipants(db))[0]).toMatchObject({ label: 'Вигадана Банківська', labelSource: 'bank' });

    await renameParticipant(db, participant, 'Моя назва');
    await syncAccounts(ctxFor(connection, { accounts: [{ id: 'c1' }], name: 'Інше Ім’я' }).ctx);
    expect((await listParticipants(db))[0]).toMatchObject({ label: 'Моя назва', labelSource: 'user' });
  });

  it('a typed name is never replaced by the bank; no name from the bank → the label stays, the warning has no data', async () => {
    db = await memoryDb();
    const typed = await person('Вигаданий Я');
    await syncAccounts(ctxFor(typed.connection, { accounts: [{ id: 'c1' }], clientId: 'h1', name: 'Банкове Ім’я' }).ctx);
    expect((await listParticipants(db))[0]?.label).toBe('Вигаданий Я');

    const participant = await addParticipant(db, { fromBank: true }, 0);
    const connection = await addConnection(db, participant, 'monobank', 0);
    const { ctx, warnings } = ctxFor(connection, { accounts: [{ id: 'c2' }], clientId: 'h2', name: null });
    await syncAccounts(ctx);
    expect((await listParticipants(db))[1]?.label).toBe(BANK_LABEL_PLACEHOLDER);
    expect(warnings).toEqual(['Банк не прислал имя владельца — подпись участника не изменена']);
  });

  it("the holder's name goes nowhere but the label: not in warnings, events or the recategorize report", async () => {
    db = await memoryDb();
    const CANARY = 'Канарейка Вигаданенко';
    const participant = await addParticipant(db, { fromBank: true }, 0);
    const connection = await addConnection(db, participant, 'monobank', 0);
    const events: unknown[] = [];
    const { ctx, warnings } = ctxFor(connection, { accounts: [{ id: 'c1' }], name: CANARY });
    await syncAccounts({ ...ctx, onEvent: (e) => events.push(e) });
    expect((await listParticipants(db))[0]?.label).toBe(CANARY);
    const report = await rederiveCore(db);
    expect(JSON.stringify({ warnings, events, report })).not.toContain('Канарейка');
  });
});

describe('duplicates', () => {
  it('a token of a holder that is already another connection is refused before anything is written', async () => {
    db = await memoryDb();
    const a = await person('Вигаданий Я');
    const b = await person('Вигадана Вона');
    await syncAccounts(ctxFor(a.connection, { accounts: [{ id: 'a1' }], clientId: 'holder-a' }).ctx);

    const err = await syncAccounts(ctxFor(b.connection, { accounts: [{ id: 'a1' }], clientId: 'holder-a' }).ctx).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ConnectionDuplicateError);
    expect(String(err)).not.toContain('holder');
    expect(await rows('SELECT id, connection_id FROM accounts')).toEqual([{ id: 'a1', connection_id: a.connection }]);
    expect(await rows('SELECT external_client_id FROM connections WHERE id = ?', [b.connection])).toEqual([{ external_client_id: null }]);
  });

  it('the holder id is not known yet, but every account is already another connection → the same holder, refused', async () => {
    db = await memoryDb();
    const a = await person('Вигаданий Я');
    const b = await person('Вигадана Вона');
    await insertAccountRow(db, { id: 'a1', connection_id: a.connection, kind: 'card', currency_code: 980, balance: 0, updated_at: 0 });
    await insertAccountRow(db, { id: 'a2', connection_id: a.connection, kind: 'card', currency_code: 980, balance: 0, updated_at: 0 });
    const err = await syncAccounts(ctxFor(b.connection, { accounts: [{ id: 'a1' }, { id: 'a2' }], clientId: 'holder-x' }).ctx).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ConnectionDuplicateError);
    expect(await rows('SELECT external_client_id FROM connections WHERE id = ?', [b.connection])).toEqual([{ external_client_id: null }]);
  });
});

describe('runPlans: several connections in one run', () => {
  async function twoConnections(bIntercept?: Fake['intercept']) {
    db = await memoryDb();
    const clock = fakeClock();
    const now = Math.floor(clock.nowMs() / 1000);
    const since = now - 2 * WINDOW_SEC + 100; // → 2 windows per account
    const a = await person('Вигаданий Я');
    const b = await person('Вигадана Вона');
    const A = ctxFor(a.connection, { accounts: [{ id: 'a1' }], clientId: 'ha', statements: { a1: [item('ta', now - 500, -100)] } }, clock);
    let bCalls = 0;
    const B = ctxFor(
      b.connection,
      {
        accounts: [{ id: 'b1' }],
        clientId: 'hb',
        statements: { b1: [item('tb', now - 600, -200)] },
        intercept: (i, url) => (bIntercept && url.includes('/statement/') ? bIntercept(bCalls++, url) : undefined),
      },
      clock,
    );
    const order: string[] = [];
    for (const [name, x] of [['A', A], ['B', B]] as const) {
      x.ctx.onEvent = (e) => {
        if (e.type === 'window-start') order.push(`${name}${e.round}`);
      };
      await syncAccounts(x.ctx);
    }
    const runs = [
      { connectionId: a.connection, ctx: A.ctx, plan: await planHistory(A.ctx, { sinceSec: since }) },
      { connectionId: b.connection, ctx: B.ctx, plan: await planHistory(B.ctx, { sinceSec: since }) },
    ];
    return { clock, runs, order, a, b, B };
  }

  it('windows take turns across connections, each connection waits only for its own request slot', async () => {
    const { clock, runs, order } = await twoConnections();
    clock.sleeps.length = 0;
    expect(await runPlans(runs)).toEqual([]);
    expect(order).toEqual(['A1', 'B1', 'A2', 'B2']);
    // One shared slot would be 4 × 60 s; two slots overlap: A waits, then B's slot is already free.
    expect(clock.sleeps.reduce((s, ms) => s + ms, 0)).toBeLessThanOrEqual(2 * 60_000);
    expect(await rows('SELECT id FROM transactions ORDER BY id')).toEqual([{ id: 'ta' }, { id: 'tb' }]);
  });

  it("a rejected credential stops only its own connection; the other finishes", async () => {
    const { runs, order, b, B } = await twoConnections(() => Response.json({ errorDescription: 'Unknown token' }, { status: 401 }));
    const failed = await runPlans(runs, (err) => err instanceof MonoApiError && err.status === 401);
    expect(failed.map((f) => f.connectionId)).toEqual([b.connection]);
    expect(order).toEqual(['A1', 'B1', 'A2']);
    expect(B.calls.filter((c) => c.url.includes('/statement/'))).toHaveLength(1);
    expect(await rows('SELECT id FROM transactions')).toEqual([{ id: 'ta' }]);
  });

  it('an error that is not a connection failure stops the whole run', async () => {
    const { runs, order } = await twoConnections(() => 'throw');
    await expect(runPlans(runs, (err) => err instanceof MonoApiError && err.status === 401)).rejects.toBeInstanceOf(MonoApiError);
    expect(order).toEqual(['A1', 'B1']);
  });
});

describe('connections: list and delete', () => {
  async function family() {
    db = await memoryDb();
    const me = await person('Вигаданий Я');
    const her = await person('Вигадана Вона');
    await insertAccountRow(db, { id: 'my-black', connection_id: me.connection, kind: 'card', type: 'black', currency_code: 980, iban: 'UA00ME1', balance: 5000, updated_at: 0 });
    await insertAccountRow(db, { id: 'her-black', connection_id: her.connection, kind: 'card', type: 'black', currency_code: 980, iban: 'UA00HER', balance: 7000, updated_at: 0 });
    const T = Date.UTC(2026, 1, 10, 12) / 1000;
    const tx = (id: string, account: string, time: number, amount: number, mcc: number, description: string) =>
      db.execute({
        sql: `INSERT INTO transactions (id, account_id, time, local_date, description, mcc, hold, amount, currency_code, raw_json, synced_at)
              VALUES (?, ?, ?, '2026-02-10', ?, ?, 0, ?, 980, '{}', 0)`,
        args: [id, account, time, description, mcc, amount],
      });
    await tx('out', 'my-black', T, -100_000, 4829, 'Вигадана Особа');
    await tx('in', 'her-black', T + 3, 100_000, 4829, 'Від: Вигаданий Я');
    await tx('her-food', 'her-black', T + 700, -30_000, 5411, 'Вигаданий Магазин');
    await db.execute({ sql: `INSERT INTO sync_state VALUES ('her-black', ?, ?, ?)`, args: [T - 86_400, T + 86_400, T + 86_400] });
    await db.execute({ sql: `INSERT INTO api_calls (endpoint, called_at, connection_id) VALUES ('/x', 1, ?)`, args: [her.connection] });
    await rederiveCore(db);
    return { me, her };
  }

  it('listConnections: participant, provider, account count, coverage — no holder id', async () => {
    const { me, her } = await family();
    await db.execute({ sql: `UPDATE connections SET external_client_id = 'secret-holder' WHERE id = ?`, args: [her.connection] });
    const list = await listConnections(db);
    expect(list).toEqual([
      { id: me.connection, participantId: me.participant, provider: 'monobank', accounts: 1, coveredFrom: null, coveredTo: null, lastSyncAt: null },
      {
        id: her.connection, participantId: her.participant, provider: 'monobank', accounts: 1,
        coveredFrom: '2026-02-09', coveredTo: '2026-02-11', lastSyncAt: expect.stringMatching(/^2026-02-11/),
      },
    ]);
    expect(JSON.stringify(list)).not.toContain('secret-holder');
  });

  it('getBalances: one participant or the whole family', async () => {
    const { me, her } = await family();
    expect((await getBalances(db)).totals).toEqual([{ currency: 980, own_funds: 12_000 }]);
    expect((await getBalances(db, { participantId: me.participant })).accounts.map((a) => a.id)).toEqual(['my-black']);
    expect((await getBalances(db, { participantId: her.participant })).totals).toEqual([{ currency: 980, own_funds: 7000 }]);
  });

  it('deleteConnection: its data goes, the family transfer becomes a transfer to a person, the empty participant goes', async () => {
    const { me, her } = await family();
    expect((await rows(`SELECT transfer_rule FROM transactions WHERE id = 'out'`))[0]?.transfer_rule).toBe('family');

    expect(await deleteConnection(db, her.connection)).toEqual({ accounts: 1, transactions: 2, participantRemoved: true });
    expect(await rows('SELECT id FROM accounts')).toEqual([{ id: 'my-black' }]);
    expect(await rows('SELECT id FROM transactions')).toEqual([{ id: 'out' }]);
    expect(await rows('SELECT * FROM sync_state')).toEqual([]);
    expect(await rows('SELECT * FROM api_calls')).toEqual([]);
    expect(await rows('SELECT id FROM participants')).toEqual([{ id: me.participant }]);
    expect(await rows(`SELECT category, transfer_rule, transfer_pair_id, is_internal_transfer FROM transactions WHERE id = 'out'`)).toEqual([
      { category: 'переводы людям', transfer_rule: null, transfer_pair_id: null, is_internal_transfer: 0 },
    ]);
    expect(await rows('PRAGMA foreign_key_check')).toEqual([]);
    await expect(deleteConnection(db, her.connection)).rejects.toBeInstanceOf(ConnectionError);
  });

  it('a participant with another connection stays', async () => {
    const { me } = await family();
    const second = await addConnection(db, me.participant, 'monobank', 0);
    expect(await deleteConnection(db, second)).toEqual({ accounts: 0, transactions: 0, participantRemoved: false });
    expect((await listParticipants(db)).map((p) => p.id)).toContain(me.participant);
  });
});
