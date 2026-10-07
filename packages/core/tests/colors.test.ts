// Colours of participants and connections (migration v10, colors.ts) and «взять имя из банка» after a rename
// (connections.holder_name, restoreBankLabel). Fictional names only.
import { openLibsql } from '@mono/db-libsql';
import { afterEach, describe, expect, it } from 'vitest';
import { ColorTakenError, COLOR_KEYS, firstFreeColor } from '../src/colors.ts';
import { ConnectionError } from '../src/connections.ts';
import { MIGRATIONS, migrate, type Db } from '../src/db.ts';
import {
  addConnection,
  addParticipant,
  listConnections,
  listParticipants,
  renameParticipant,
  restoreBankLabel,
  setParticipantColor,
} from '../src/participants.ts';
import { createMonoClient } from '../src/providers/monobank/client.ts';
import { syncAccounts } from '../src/sync.ts';
import { TEST_TOKEN, fakeClock, fakeMonobank, memoryDb } from './helpers.ts';

let db: Db;
afterEach(() => db?.close());

const rows = async (sql: string) => (await db.execute(sql)).rows;

async function sync(connectionId: number, name: string | null, clientId: string) {
  const clock = fakeClock();
  const api = createMonoClient({ token: TEST_TOKEN, db, fetch: fakeMonobank({ accounts: [{ id: `acc-${clientId}` }], clientId, name }).fetch, clock, connectionId });
  await syncAccounts({ db, api, clock, connectionId, warn: () => undefined });
}

describe('migration v10', () => {
  it('existing rows get the palette in id order; past its length — none; the key and uniqueness are checked', async () => {
    db = await openLibsql(':memory:');
    const upTo9 = MIGRATIONS.filter((m) => m.version <= 9);
    for (const m of upTo9) await db.batch(m.statements.map((sql) => ({ sql, args: [] })));
    await db.execute('CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at INTEGER NOT NULL)');
    for (const m of upTo9) await db.execute({ sql: 'INSERT INTO schema_migrations VALUES (?, ?, 0)', args: [m.version, m.name] });
    for (let i = 1; i <= 10; i++) {
      await db.execute(`INSERT INTO participants (id, label, sort, created_at) VALUES (${i * 3}, 'Особа ${i}', ${i}, 0)`);
      await db.execute(`INSERT INTO connections (id, participant_id, provider, created_at) VALUES (${i * 2}, ${i * 3}, 'monobank', 0)`);
    }

    expect(await migrate(db, 0)).toEqual([10, 11, 12, 13, 14, 15]);
    const expected = [...COLOR_KEYS, null, null];
    expect((await rows('SELECT color FROM participants ORDER BY id')).map((r) => r.color)).toEqual(expected);
    expect((await rows('SELECT color FROM connections ORDER BY id')).map((r) => r.color)).toEqual(expected);
    expect((await rows('SELECT holder_name FROM connections')).every((r) => r.holder_name === null)).toBe(true);

    await expect(db.execute(`UPDATE participants SET color = 'blue' WHERE id = 30`)).rejects.toThrow(/UNIQUE/i);
    await expect(db.execute(`UPDATE connections SET color = 'pink' WHERE id = 20`)).rejects.toThrow(/CHECK/i);
  });
});

describe('colours', () => {
  it('a new participant takes the first free colour; one asked for must be free; none left → no colour; a connection none', async () => {
    db = await memoryDb();
    const a = await addParticipant(db, { label: 'Перша' }, 0);
    const b = await addParticipant(db, { label: 'Друга', color: 'red' }, 0);
    const c = await addParticipant(db, { fromBank: true }, 0);
    expect((await listParticipants(db)).map((p) => [p.id, p.color])).toEqual([[a, 'blue'], [b, 'red'], [c, 'orange']]);
    await expect(addParticipant(db, { label: 'Третя', color: 'red' }, 0)).rejects.toBeInstanceOf(ColorTakenError);

    // A new connection has no colour (only people have one).
    const x = await addConnection(db, a, 'monobank', 0);
    const y = await addConnection(db, b, 'monobank', 0);
    expect((await db.execute('SELECT id, color FROM connections ORDER BY id')).rows.map((k) => [Number(k.id), k.color])).toEqual([[x, null], [y, null]]);
    expect((await listConnections(db)).every((k) => !('color' in k))).toBe(true);

    for (let i = 0; i < COLOR_KEYS.length - 3; i++) await addParticipant(db, { label: `Ще ${i}` }, 0);
    expect(await firstFreeColor(db, 'participants')).toBeNull();
    const last = await addParticipant(db, { label: 'Без кольору' }, 0);
    expect((await listParticipants(db)).find((p) => p.id === last)?.color).toBeNull();
  });

  it('changing a person\'s: to a free colour or its own; another person\'s → ColorTakenError; unknown id → ConnectionError', async () => {
    db = await memoryDb();
    const a = await addParticipant(db, { label: 'Перша' }, 0);
    const b = await addParticipant(db, { label: 'Друга' }, 0);
    await setParticipantColor(db, a, 'green');
    await setParticipantColor(db, a, 'green');
    await expect(setParticipantColor(db, b, 'green')).rejects.toBeInstanceOf(ColorTakenError);
    expect((await listParticipants(db)).map((p) => p.color)).toEqual(['green', 'orange']);
    await expect(setParticipantColor(db, 999, 'aqua')).rejects.toBeInstanceOf(ConnectionError);
  });
});

describe('«взять имя из банка» after a rename', () => {
  it("the holder's name is kept while the user's name is the label, and applies at once when asked", async () => {
    db = await memoryDb();
    const p = await addParticipant(db, { label: 'Моя назва' }, 0);
    const conn = await addConnection(db, p, 'monobank', 0);
    await sync(conn, ' Вигадана  Банківська ', 'h1');
    expect((await listParticipants(db))[0]).toMatchObject({ label: 'Моя назва', labelSource: 'user' });

    await restoreBankLabel(db, p);
    expect((await listParticipants(db))[0]).toMatchObject({ label: 'Вигадана Банківська', labelSource: 'bank' });
    await sync(conn, 'Нове Банківське', 'h1');
    expect((await listParticipants(db))[0]?.label).toBe('Нове Банківське');

    await renameParticipant(db, p, 'Знову своя');
    await restoreBankLabel(db, p);
    expect((await listParticipants(db))[0]).toMatchObject({ label: 'Нове Банківське', labelSource: 'bank' });
  });

  it('no name from the bank yet → the label stays until the import; unknown id → ConnectionError', async () => {
    db = await memoryDb();
    const p = await addParticipant(db, { label: 'Своя' }, 0);
    await addConnection(db, p, 'monobank', 0);
    await restoreBankLabel(db, p);
    expect((await listParticipants(db))[0]).toMatchObject({ label: 'Своя', labelSource: 'bank' });
    await expect(restoreBankLabel(db, 999)).rejects.toBeInstanceOf(ConnectionError);
  });
});
