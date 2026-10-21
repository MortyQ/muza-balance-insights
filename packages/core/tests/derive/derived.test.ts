// Stored crossing (derived.ts, transactions.crossing_category): who derives it and when. The figures it gives are
// checked by account-toggles.test.ts through the statistics. Fictional data only.
import fs from 'node:fs';
import { openLibsql } from '@mono/db-libsql';
import { afterEach, describe, expect, it } from 'vitest';
import { deleteConnection, setAccountEnabled } from '../../src/commands/people.ts';
import { MIGRATIONS, migrate, type Db, type Stmt } from '../../src/storage/db.ts';
import { refreshCrossing } from '../../src/derive/derived.ts';
import { kyivStartOfDay, toKyivDate } from '../../src/shared/format.ts';
import { addConnection, addParticipant } from '../../src/people/participants.ts';
import { monobankStatement } from '../../src/providers/monobank/statement.ts';
import { rederiveCore } from '../../src/derive/rederive.ts';
import { commitStatement } from '../../src/ingest/statement-import.ts';
import { commitRows } from '../../src/ingest/sync.ts';
import { insertAccountRow, insertTransactionRow, memoryDb, testConnection } from '../helpers.ts';

let db: Db;
afterEach(() => db?.close());

const T = kyivStartOfDay('2026-02-10') + 12 * 3600;
const crossing = async () =>
  Object.fromEntries((await db.execute('SELECT id, crossing_category FROM transactions ORDER BY id')).rows.map((r) => [r.id, r.crossing_category]));
const fingerprint = async () => (await db.execute("SELECT value FROM derived_state WHERE key = 'crossing_accounts'")).rows[0]?.value ?? null;

const tx = (id: string, accountId: string, time: number, amount: number, description: string, mcc = 4829) =>
  insertTransactionRow(db, { id, account_id: accountId, time, local_date: toKyivDate(time), description, mcc, hold: 0, amount, currency_code: 980, synced_at: 0 });

/** A card and a jar of one connection with a paired top-up between them, derived. The jar's state is the caller's. */
async function cardAndJar(jar: { balance: number; covered: boolean }): Promise<void> {
  db = await memoryDb();
  await insertAccountRow(db, { id: 'card', kind: 'card', type: 'black', currency_code: 980, iban: 'UA00CARD', balance: 100_000, credit_limit: 0, updated_at: T });
  await insertAccountRow(db, { id: 'jar', kind: 'jar', currency_code: 980, title: 'Вигадана банка', balance: jar.balance, updated_at: T });
  await db.execute({ sql: `INSERT INTO sync_state VALUES ('card', ?, ?, ?)`, args: [T - 86_400, T + 86_400, T + 86_400] });
  if (jar.covered) await db.execute({ sql: `INSERT INTO sync_state VALUES ('jar', ?, ?, ?)`, args: [T - 86_400, T + 86_400, T + 86_400] });
  await tx('to-jar', 'card', T, -10_000, 'Вигаданий переказ');
  await tx('in-jar', 'jar', T + 2, 10_000, 'Вигаданий переказ');
  await tx('food', 'card', T + 100, -5_000, 'Вигаданий Магазин', 5411);
  await rederiveCore(db);
}

/** Counts the statements that can write (anything but a SELECT), through execute and batch alike. */
function countingWrites(d: Db): { db: Db; writes: () => number } {
  let n = 0;
  const writes = (s: Stmt) => !/^\s*(SELECT|WITH)\b/i.test(typeof s === 'string' ? s : s.sql);
  return {
    db: {
      execute: (s) => ((n += writes(s) ? 1 : 0), d.execute(s)),
      batch: (ss) => ((n += ss.filter(writes).length), d.batch(ss)),
      close: () => d.close(),
    },
    writes: () => n,
  };
}

describe('refreshCrossing: when the accounts change', () => {
  it('a toggle: the transfer to a turned-off jar crosses at once, and stops crossing when it is back on', async () => {
    await cardAndJar({ balance: 500, covered: true });
    expect(await crossing()).toEqual({ food: null, 'in-jar': null, 'to-jar': null });

    await setAccountEnabled(db, 'jar', false);
    const off = await crossing();
    expect(off['to-jar']).toEqual(expect.any(String));
    expect(off['in-jar']).toBeNull(); // a row of the disabled account itself is in no statistic
    expect(off.food).toBeNull();

    await setAccountEnabled(db, 'jar', true);
    expect(await crossing()).toEqual({ food: null, 'in-jar': null, 'to-jar': null });
  });

  it("the auto rule flips after an import: the jar's first coverage makes it count, and the transfer stops crossing", async () => {
    await cardAndJar({ balance: 0, covered: false });
    expect((await crossing())['to-jar']).toEqual(expect.any(String));

    await commitRows(db, { provider: 'monobank', accountId: 'jar', window: { from: T - 3600, to: T + 3600 }, items: [], nowSec: T, cancelHolds: false });
    expect((await crossing())['to-jar']).toBeNull();
  });

  it('a window commit derives the rows it wrote when the accounts did not change (range mode)', async () => {
    await cardAndJar({ balance: 500, covered: true });
    await setAccountEnabled(db, 'jar', false);
    const before = await fingerprint();

    // The card's half of a new top-up arrives; the jar's half is already there (written before the jar was turned off).
    await tx('in-jar-2', 'jar', T + 5000, 2_000, 'Вигаданий переказ');
    await commitRows(db, {
      provider: 'monobank',
      accountId: 'card',
      window: { from: T + 4000, to: T + 6000 },
      items: [{ id: 'to-jar-2', time: T + 4998, amount: -2_000, currencyCode: 980, hold: false, mcc: 4829, description: 'Вигаданий переказ', raw: '{}' }],
      nowSec: T,
      cancelHolds: true,
    });
    expect(await fingerprint()).toBe(before);
    expect((await crossing())['to-jar-2']).toEqual(expect.any(String));
  });

  it('a statement upload that creates a card refreshes in full (the new card is in the fingerprint)', async () => {
    db = await memoryDb();
    const me = await addParticipant(db, { label: 'Вигадана Особа' }, 0);
    const conn = await addConnection(db, me, 'monobank', 0, 'file');
    await refreshCrossing(db);
    expect(await fingerprint()).not.toContain('file-card-1');
    const parsed = monobankStatement.parse(fs.readFileSync(new URL('../providers/monobank/fixtures/statement-card-uk.csv', import.meta.url), 'utf8'));
    if (!parsed.ok) throw new Error(parsed.problem);
    await commitStatement(db, conn, parsed.statement, { kind: 'new', id: 'file-card-1', type: 'black' }, 1);
    expect(await fingerprint()).toContain('file-card-1');
  });

  it('removing a connection: what crossed to its accounts is re-derived with the rest', async () => {
    db = await memoryDb();
    const me = await testConnection(db);
    const her = Number((await db.execute(`INSERT INTO participants (label, created_at) VALUES ('Вигадана особа', 0) RETURNING id`)).rows[0]?.id);
    const herConn = Number((await db.execute({ sql: `INSERT INTO connections (participant_id, provider, created_at) VALUES (?, 'monobank', 0) RETURNING id`, args: [her] })).rows[0]?.id);
    await insertAccountRow(db, { id: 'mine', connection_id: me, kind: 'card', type: 'black', currency_code: 980, iban: 'UA00ME', balance: 0, updated_at: T });
    await insertAccountRow(db, { id: 'hers', connection_id: herConn, kind: 'card', type: 'black', currency_code: 980, iban: 'UA00HER', balance: 0, updated_at: T });
    await tx('to-her', 'mine', T, -3_000, 'Вигадана Особа');
    await tx('her-in', 'hers', T + 2, 3_000, 'Від: Вигаданий Я');
    await rederiveCore(db);
    await setAccountEnabled(db, 'hers', false);
    expect((await crossing())['to-her']).toEqual(expect.any(String));

    await deleteConnection(db, herConn);
    // Her rows are gone, so the transfer has no pair any more: an ordinary operation by its own marks, not a crossing.
    expect(await crossing()).toEqual({ 'to-her': null });
    expect(await fingerprint()).not.toContain('hers');
  });

  it('the first open after the migration fills the column for an account turned off before it', async () => {
    db = await openLibsql(':memory:');
    const old = MIGRATIONS.filter((m) => m.version <= 15);
    for (const m of old) await db.batch(m.statements.map((sql) => ({ sql, args: [] })));
    await db.execute('CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at INTEGER NOT NULL)');
    for (const m of old) await db.execute({ sql: 'INSERT INTO schema_migrations VALUES (?, ?, 0)', args: [m.version, m.name] });
    await db.batch([
      `INSERT INTO participants (id, label, created_at) VALUES (1, 'Я', 0)`,
      `INSERT INTO connections (id, participant_id, provider, created_at) VALUES (1, 1, 'monobank', 0)`,
      `INSERT INTO accounts (id, connection_id, kind, type, currency_code, balance, updated_at) VALUES ('card', 1, 'card', 'black', 980, 0, 0)`,
      `INSERT INTO accounts (id, connection_id, kind, currency_code, title, balance, updated_at, sync_choice) VALUES ('jar', 1, 'jar', 980, 'Вигадана банка', 500, 0, 0)`,
      `INSERT INTO transactions (id, account_id, time, local_date, description, mcc, hold, amount, currency_code, raw_json, synced_at,
         is_internal_transfer, transfer_rule, transfer_pair_id, category)
       VALUES ('to-jar', 'card', 100, '1970-01-01', 'Вигаданий переказ', 4829, 0, -100, 980, '{}', 0, 1, 'pair', 'in-jar', 'свои переводы')`,
      `INSERT INTO transactions (id, account_id, time, local_date, description, mcc, hold, amount, currency_code, raw_json, synced_at,
         is_internal_transfer, transfer_rule, transfer_pair_id, category)
       VALUES ('in-jar', 'jar', 102, '1970-01-01', 'Вигаданий переказ', 4829, 0, 100, 980, '{}', 0, 1, 'pair', 'to-jar', 'свои переводы')`,
    ]);
    await migrate(db, 0);
    expect((await crossing())['to-jar']).toBeNull();

    await refreshCrossing(db);
    expect((await crossing())['to-jar']).toEqual(expect.any(String));
  });
});

describe('refreshCrossing: nothing changed', () => {
  it('writes nothing at all — with or without a span', async () => {
    await cardAndJar({ balance: 500, covered: true });
    await setAccountEnabled(db, 'jar', false);
    const counted = countingWrites(db);
    await refreshCrossing(counted.db);
    await refreshCrossing(counted.db, { from: T - 86_400, to: T + 86_400 });
    expect(counted.writes()).toBe(0);
  });
});

describe('every writer of accounts or coverage refreshes crossing', () => {
  const SRC = new URL('../../src/', import.meta.url);
  const WRITES = /\b(INSERT INTO|UPDATE|DELETE FROM|REPLACE INTO)\s+(accounts|sync_state)\b/;
  /** The functions that write accounts or sync_state, and how each keeps crossing right. */
  const WRITERS: Record<string, Record<string, RegExp>> = {
    'commands/people.ts': { setAccountEnabled: /\brefreshCrossing\(/, deleteConnection: /\brederiveCore\(/ },
    // commitRows refreshes through its derivation pass, deriveSpan (derive/rederive.ts, checked below).
    'ingest/sync.ts': { syncAccounts: /\brefreshCrossing\(/, commitRows: /\bderiveSpan\(/ },
    'ingest/statement-import.ts': { commitStatement: /\bcommitRows\(/ },
  };
  const bodyOf = (src: string, name: string): string => {
    const start = src.search(new RegExp(`export async function ${name}\\(`));
    if (start < 0) throw new Error(`${name} not found`);
    const next = src.indexOf('\nexport ', start + 1);
    return src.slice(start, next < 0 ? undefined : next);
  };

  it('the files that write them are exactly the listed ones', () => {
    const files = fs
      .readdirSync(SRC, { recursive: true, encoding: 'utf8' })
      .map((f) => f.replaceAll('\\', '/'))
      .filter((f) => f.endsWith('.ts') && f !== 'storage/db.ts');
    const writing = files.filter((f) => WRITES.test(fs.readFileSync(new URL(f, SRC), 'utf8'))).sort();
    expect(writing).toEqual(Object.keys(WRITERS).sort());
  });

  it.each(Object.entries(WRITERS).flatMap(([file, fns]) => Object.entries(fns).map(([fn, call]) => [file, fn, call] as const)))(
    '%s %s',
    (file, fn, call) => {
      expect(bodyOf(fs.readFileSync(new URL(file, SRC), 'utf8'), fn)).toMatch(call);
    },
  );

  it('deriveSpan, the pass of commitRows and of the end of an import, refreshes crossing', () => {
    expect(bodyOf(fs.readFileSync(new URL('derive/rederive.ts', SRC), 'utf8'), 'deriveSpan')).toMatch(/\brefreshCrossing\(/);
  });

  it('every write in the listed files sits in a listed function', () => {
    for (const [file, fns] of Object.entries(WRITERS)) {
      const src = fs.readFileSync(new URL(file, SRC), 'utf8');
      const covered = Object.keys(fns).map((fn) => bodyOf(src, fn));
      for (const m of src.matchAll(new RegExp(WRITES.source, 'g'))) {
        const line = src.slice(src.lastIndexOf('\n', m.index) + 1, src.indexOf('\n', m.index));
        expect(covered.some((b) => b.includes(line)), `${file}: ${line.trim()}`).toBe(true);
      }
    }
  });
});
