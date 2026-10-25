// Stored ids (providers/ids.ts): a second, fictional bank with 'prefixed' ids next to Monobank. Both send the same
// account and operation ids; both are stored, Monobank's exactly as sent. The fictional bank is added to the
// registries by mocks only; it borrows Monobank's rules and API facts. Invented data only.
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Db } from '../../src/storage/db.ts';
import type { NormalizedTx, ParsedStatement, ProviderClient, ProviderId, ProviderInfo } from '../../src/providers/types.ts';
import { bankIdOf, storedId } from '../../src/providers/ids.ts';
import { createMonoClient } from '../../src/providers/monobank/client.ts';
import { addConnection, addParticipant } from '../../src/people/participants.ts';
import { syncAccounts, syncWindow, type SyncContext } from '../../src/ingest/sync.ts';
import { commitStatement } from '../../src/ingest/statement-import.ts';
import { TEST_TOKEN, fakeClock, fakeMonobank, item, memoryDb } from '../helpers.ts';

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
  return {
    ...real,
    PROVIDERS: providers,
    infoOf: (p: string) => providers[p],
    apiOf: (p: string) => providers[p]?.access.token?.api,
  };
});
vi.mock('../../src/providers/rules.ts', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../src/providers/rules.ts')>();
  return { ...real, rulesFor: (p: string) => real.rulesFor(p === 'fictional' ? 'monobank' : (p as ProviderId)) };
});

const FICTIONAL = 'fictional' as ProviderId;
const T = Date.UTC(2025, 5, 10) / 1000;
const W = { from: T - 86_400, to: T + 86_400 };

let db: Db;
afterEach(() => db?.close());

/** A fictional bank's client: one card 'acc1' with one operation 'tx1'; remembers which account ids it was asked for. */
function fictionalClient() {
  const asked: string[] = [];
  const tx: NormalizedTx = { id: 'tx1', time: T, amount: -250, currencyCode: 980, hold: false, description: 'Fictional shop', raw: '{"id":"tx1"}' };
  const api: ProviderClient = {
    provider: FICTIONAL,
    accounts: async () => ({
      externalClientId: 'f1',
      holderName: null,
      accounts: [
        { id: 'acc1', kind: 'card', type: null, currencyCode: 980, iban: null, maskedPan: null, title: null, goal: null, balance: 100, creditLimit: null },
      ],
    }),
    statementWindow: async (accountId) => {
      asked.push(accountId);
      return accountId === 'acc1' ? [tx] : [];
    },
  };
  return { api, asked };
}

const rows = async (sql: string) => (await db.execute(sql)).rows.map((r) => ({ ...r }));

describe('stored ids', () => {
  it('Monobank is bare: its ids are stored as sent; a prefixed bank gets its prefix, and back', () => {
    expect(storedId('monobank', 'acc1')).toBe('acc1');
    expect(bankIdOf('monobank', 'acc1')).toBe('acc1');
    expect(storedId(FICTIONAL, 'acc1')).toBe('fictional:acc1');
    expect(bankIdOf(FICTIONAL, 'fictional:acc1')).toBe('acc1');
    expect(() => bankIdOf(FICTIONAL, 'acc1')).toThrow(/not an id of fictional/);
  });

  it('two banks send the same account and operation ids: both are stored, each under its own provider', async () => {
    db = await memoryDb();
    const clock = fakeClock(T * 1000 + 3_600_000);
    const mono = fakeMonobank({ accounts: [{ id: 'acc1' }], statements: { acc1: [item('tx1', T, -100)] } });
    const monoCtx: SyncContext = { db, clock, api: createMonoClient({ token: TEST_TOKEN, db, fetch: mono.fetch, clock, rateLimitMode: 'wait' }) };
    const fictional = fictionalClient();
    const ficCtx: SyncContext = { db, clock, api: fictional.api };

    await syncAccounts(monoCtx);
    await syncAccounts(ficCtx);
    await syncWindow(monoCtx, 'acc1', W);
    await syncWindow(ficCtx, 'fictional:acc1', W);

    expect(await rows('SELECT a.id, c.provider FROM accounts a JOIN connections c ON c.id = a.connection_id ORDER BY a.id')).toEqual([
      { id: 'acc1', provider: 'monobank' },
      { id: 'fictional:acc1', provider: 'fictional' },
    ]);
    expect(await rows('SELECT id, account_id, amount FROM transactions ORDER BY id')).toEqual([
      { id: 'fictional:tx1', account_id: 'fictional:acc1', amount: -250 },
      { id: 'tx1', account_id: 'acc1', amount: -100 },
    ]);
    expect(await rows('SELECT id FROM transaction_raw ORDER BY id')).toEqual([{ id: 'fictional:tx1' }, { id: 'tx1' }]);
    expect(await rows('SELECT account_id FROM sync_state ORDER BY account_id')).toEqual([{ account_id: 'acc1' }, { account_id: 'fictional:acc1' }]);
    // The client is asked by the bank's own id; Monobank's URL carries the bare id.
    expect(fictional.asked).toEqual(['acc1']);
    expect(mono.calls.some((c) => c.url.includes('/personal/statement/acc1/'))).toBe(true);

    // A second run over the same window changes nothing: the stored ids are found again, no hold is cancelled.
    await syncWindow(ficCtx, 'fictional:acc1', W);
    expect(await rows("SELECT id, is_cancelled FROM transactions WHERE account_id = 'fictional:acc1'")).toEqual([{ id: 'fictional:tx1', is_cancelled: 0 }]);
  });

  it("a statement file's new account gets the prefix and its rows inherit it; Monobank's stays bare", async () => {
    db = await memoryDb();
    const me = await addParticipant(db, { label: 'Fictional Person' }, 0);
    const ficFile = await addConnection(db, me, FICTIONAL, 0, 'file');
    const monoFile = await addConnection(db, me, 'monobank', 0, 'file');
    const statement: ParsedStatement = {
      kind: 'card',
      currencyCode: 980,
      account: { iban: null, cards: [], type: null },
      rows: [{ time: T, amount: -300, currencyCode: 980, hold: false, description: 'Fictional shop', raw: '{}' }],
      closingBalance: 700,
    };

    await commitStatement(db, ficFile, [statement], [{ kind: 'new', id: 'file-1', type: null }], 1);
    await commitStatement(db, monoFile, [statement], [{ kind: 'new', id: 'file-1', type: null }], 1);

    expect(await rows('SELECT id FROM accounts ORDER BY id')).toEqual([{ id: 'fictional:file-1' }, { id: 'file-1' }]);
    expect(await rows('SELECT id, account_id FROM transactions ORDER BY id')).toEqual([
      { id: `fictional:file-1:${T}:-300:0`, account_id: 'fictional:file-1' },
      { id: `file-1:${T}:-300:0`, account_id: 'file-1' },
    ]);
    // The taken-id check looks at the stored id.
    await expect(commitStatement(db, ficFile, [statement], [{ kind: 'new', id: 'file-1', type: null }], 2)).rejects.toThrow(/taken/);
  });
});
