// Migration v8 (participants, connections, accounts.connection_id) and what the sync does with connections:
// the holder id, accounts of another connection, one request slot per connection. Fictional data only.
import { afterEach, describe, expect, it } from 'vitest';
import { openLibsql } from '@mono/db-libsql';
import { ensureDefaultConnection } from '../src/connections.ts';
import { MIGRATIONS, migrate, type Db } from '../src/db.ts';
import { RateLimitError } from '../src/errors.ts';
import { createMonoClient } from '../src/providers/monobank/client.ts';
import { acquireSlot } from '../src/ratelimit.ts';
import { ConnectionMismatchError, syncAccounts, type SyncContext } from '../src/sync.ts';
import { TEST_TOKEN, fakeClock, fakeMonobank, insertAccountRow, memoryDb } from './helpers.ts';

let db: Db | undefined;
afterEach(() => {
  db?.close();
  db = undefined;
});

/** A database at schema v7 (before connections), built by the real migrations. */
async function v7(): Promise<Db> {
  const d = await openLibsql(':memory:');
  for (const m of MIGRATIONS.filter((x) => x.version <= 7)) await d.batch(m.statements.map((sql) => ({ sql, args: [] })));
  await d.execute(`CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at INTEGER NOT NULL)`);
  for (const m of MIGRATIONS.filter((x) => x.version <= 7)) {
    await d.execute({ sql: 'INSERT INTO schema_migrations VALUES (?, ?, 0)', args: [m.version, m.name] });
  }
  return d;
}

const rows = async (d: Db, sql: string) => (await d.execute(sql)).rows;
const indexes = async (d: Db) =>
  (await rows(d, "SELECT name FROM sqlite_master WHERE type = 'index' AND name LIKE 'idx_%' ORDER BY name")).map((r) => String(r.name));

describe('migration v8', () => {
  it('existing data: one participant «Я» + one Monobank connection; every row and value kept; foreign keys intact', async () => {
    db = await v7();
    await db.batch([
      `INSERT INTO accounts (id, kind, type, currency_code, iban, masked_pan, balance, credit_limit, updated_at)
        VALUES ('black', 'card', 'black', 980, 'UA00FICTIONAL1', '["537541******0000"]', 1000, 500, 111)`,
      `INSERT INTO accounts (id, kind, currency_code, title, goal, balance, updated_at) VALUES ('jar', 'jar', 980, 'Вигадана банка', 9000, 50, 222)`,
      `INSERT INTO transactions (id, account_id, time, local_date, description, mcc, hold, amount, currency_code, raw_json, synced_at,
          category, is_internal_transfer, transfer_pair_id, transfer_rule, refund_pair_id, scope, counter_name)
        VALUES ('t1', 'black', 100, '2026-01-01', 'На банку', 4829, 0, -500, 980, '{}', 1, 'свои переводы', 1, 't2', 'pair', NULL, 'personal', NULL)`,
      `INSERT INTO transactions (id, account_id, time, local_date, description, mcc, hold, amount, currency_code, raw_json, synced_at,
          category, is_internal_transfer, transfer_pair_id, transfer_rule, scope)
        VALUES ('t2', 'jar', 101, '2026-01-01', 'З Чорної картки', 4829, 0, 500, 980, '{}', 1, 'свои переводы', 1, 't1', 'pair', 'business')`,
      `INSERT INTO sync_state VALUES ('black', 10, 200, 300)`,
      `INSERT INTO api_calls (endpoint, called_at) VALUES ('/personal/client-info', 5000)`,
    ]);
    const before = {
      accounts: await rows(db, 'SELECT * FROM accounts ORDER BY id'),
      transactions: await rows(db, 'SELECT * FROM transactions ORDER BY id'),
      sync: await rows(db, 'SELECT * FROM sync_state ORDER BY account_id'),
      indexes: await indexes(db),
    };

    expect(await migrate(db, 0)).toEqual([8, 9]);

    expect(await rows(db, 'SELECT id, label, created_at FROM participants')).toEqual([{ id: 1, label: 'Я', created_at: 222 }]);
    expect(await rows(db, 'SELECT id, participant_id, provider, external_client_id FROM connections')).toEqual([
      { id: 1, participant_id: 1, provider: 'monobank', external_client_id: null },
    ]);
    expect(await rows(db, 'SELECT * FROM accounts ORDER BY id')).toEqual(before.accounts.map((a) => ({ ...a, connection_id: 1 })));
    expect(await rows(db, 'SELECT * FROM transactions ORDER BY id')).toEqual(before.transactions);
    expect(await rows(db, 'SELECT * FROM sync_state ORDER BY account_id')).toEqual(before.sync);
    expect(await rows(db, 'SELECT connection_id FROM api_calls')).toEqual([{ connection_id: 1 }]);
    expect(await rows(db, 'PRAGMA foreign_key_check')).toEqual([]);
    expect(await indexes(db)).toEqual([...before.indexes, 'idx_accounts_connection'].sort());
    expect(await rows(db, "SELECT name FROM sqlite_master WHERE name = 'accounts_old'")).toEqual([]);
    // The new tables still enforce their references and checks.
    await expect(db.execute(`INSERT INTO accounts (id, connection_id, kind, currency_code, balance, updated_at) VALUES ('x', 99, 'card', 980, 0, 0)`)).rejects.toThrow(/FOREIGN KEY/i);
    await expect(db.execute(`UPDATE transactions SET transfer_rule = 'bogus' WHERE id = 't1'`)).rejects.toThrow(/CHECK/i);
    await db.execute(`UPDATE transactions SET transfer_rule = 'family' WHERE id = 't1'`);

    expect(await migrate(db, 0)).toEqual([]);
  });

  it('an empty database gets no participant and no connection; the first one comes from ensureDefaultConnection', async () => {
    db = await v7();
    await migrate(db, 0);
    expect(await rows(db, 'SELECT * FROM participants')).toEqual([]);
    expect(await rows(db, 'SELECT * FROM connections')).toEqual([]);
    const id = await ensureDefaultConnection(db, 'monobank', 42);
    expect(await ensureDefaultConnection(db, 'monobank', 43)).toBe(id);
    expect(await rows(db, 'SELECT label, created_at FROM participants')).toEqual([{ label: 'Я', created_at: 42 }]);
  });
});

describe('sync with connections', () => {
  function ctxFor(d: Db, clientId: string, accounts: Array<{ id: string }>, connectionId?: number): SyncContext & { warnings: string[] } {
    const clock = fakeClock();
    const warnings: string[] = [];
    const mono = fakeMonobank({ accounts, clientId });
    const api = createMonoClient({ token: TEST_TOKEN, db: d, fetch: mono.fetch, clock, ...(connectionId ? { connectionId } : {}) });
    return { db: d, api, clock, warnings, warn: (m) => warnings.push(m), ...(connectionId ? { connectionId } : {}) };
  }

  it('remembers the holder id on the first sync; a credential of another holder is refused before anything is written', async () => {
    db = await memoryDb();
    await syncAccounts(ctxFor(db, 'holder-a', [{ id: 'a1' }]));
    expect(await rows(db, 'SELECT external_client_id FROM connections')).toEqual([{ external_client_id: 'holder-a' }]);

    const err = await syncAccounts(ctxFor(db, 'holder-b', [{ id: 'b1' }])).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ConnectionMismatchError);
    expect(String(err)).not.toContain('holder');
    expect(await rows(db, 'SELECT id FROM accounts')).toEqual([{ id: 'a1' }]);
  });

  it("an account that belongs to another connection is left as it is (warning), the rest is written", async () => {
    db = await memoryDb();
    await insertAccountRow(db, { id: 'shared', kind: 'card', currency_code: 980, balance: 7, updated_at: 0 });
    await db.execute(`INSERT INTO participants (label, created_at) VALUES ('Вигадана особа', 0)`);
    const other = Number((await db.execute(`INSERT INTO connections (participant_id, provider, created_at) VALUES (2, 'monobank', 0) RETURNING id`)).rows[0]?.id);

    const ctx = ctxFor(db, 'holder-x', [{ id: 'shared' }, { id: 'own' }], other);
    expect(await syncAccounts(ctx)).toEqual({ cards: 1, jars: 0 });
    expect(ctx.warnings.join('\n')).toMatch(/другом подключении: 1/);
    expect(await rows(db, 'SELECT id, connection_id, balance FROM accounts ORDER BY id')).toEqual([
      { id: 'own', connection_id: other, balance: 1000 },
      { id: 'shared', connection_id: 1, balance: 7 },
    ]);
  });

  it('one request slot per connection: two connections do not wait for each other', async () => {
    db = await memoryDb();
    const clock = fakeClock();
    const limit = (connectionId: number | null) => ({ intervalMs: 60_000, bank: 'Monobank', connectionId });
    await db.execute(`INSERT INTO participants (label, created_at) VALUES ('Я', 0)`);
    await db.batch([
      `INSERT INTO connections (participant_id, provider, created_at) VALUES (1, 'monobank', 0)`,
      `INSERT INTO connections (participant_id, provider, created_at) VALUES (1, 'monobank', 0)`,
    ]);
    await acquireSlot(db, '/x', clock, 'fail', limit(1));
    await acquireSlot(db, '/x', clock, 'fail', limit(2)); // no wait: another credential
    await expect(acquireSlot(db, '/x', clock, 'fail', limit(1))).rejects.toBeInstanceOf(RateLimitError);
    await acquireSlot(db, '/x', clock, 'fail', limit(null)); // calls without a connection have their own slot
    clock.advance(60_001);
    await acquireSlot(db, '/x', clock, 'fail', limit(1));
  });
});
