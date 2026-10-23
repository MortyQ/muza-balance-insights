// The data process's handler table (src/data/host.ts) on an in-memory database: each method answers, arguments are
// checked before anything runs, errors cross as a code and a name (never the message), calls run one at a time.
// Fictional data only.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Db } from '@mono/core/storage/db';
import { memoryDb } from '@mono/core/test-helpers';
import { openLibsql } from '@mono/db-libsql';
import { DataHost } from '../src/data/host.ts';
import { dataApi } from '../src/main/data-api.ts';
import { DataCallError, type CallMessage, type DataMethod } from '../src/shared/data-protocol.ts';

let db: Db;
beforeEach(async () => {
  db = await memoryDb();
});
afterEach(() => db.close());

const hostOn = (d: Db) => new DataHost({ open: async () => d, release: async () => undefined, nowSec: () => 1_000, rates: async () => null });
let ids = 0;
const call = (method: DataMethod, args: unknown[]): CallMessage => ({ type: 'call', id: ++ids, method, args });

describe('DataHost', () => {
  it('opens a fresh database: migrated before the first call', async () => {
    const raw = await openLibsql(':memory:');
    try {
      const host = hostOn(raw);
      await host.open();
      expect(Number((await raw.execute('SELECT COUNT(*) AS n FROM schema_migrations')).rows[0]?.n)).toBeGreaterThan(0);
    } finally {
      raw.close();
    }
  });

  it('answers each kind of method: status, a connection created and listed with its person', async () => {
    const host = hostOn(db);
    const status = await host.handle(call('status', []));
    expect(status).toMatchObject({ type: 'result', value: { hasData: false } });
    const created = await host.handle(call('createConnection', [{ label: 'Вигадана Особа' }, 'monobank', 'file']));
    if (created.type !== 'result') throw new Error('not created');
    const { connectionId, participantId } = created.value as { connectionId: number; participantId: number };
    expect(await host.handle(call('connections', []))).toMatchObject({ value: [{ id: connectionId, provider: 'monobank', method: 'file' }] });
    const people = await host.handle(call('people', []));
    expect(people).toMatchObject({ value: [{ id: participantId, label: 'Вигадана Особа', connections: [{ id: connectionId, method: 'file' }] }] });
    expect(JSON.stringify(people)).not.toMatch(/"token"|"bank"|external_client_id|holder/);
  });

  it('a refusal is a value: a taken colour', async () => {
    const host = hostOn(db);
    await host.handle(call('createConnection', [{ label: 'Перша', color: 'violet' }, 'monobank', 'file']));
    const second = await host.handle(call('createConnection', [{ label: 'Друга' }, 'monobank', 'file']));
    if (second.type !== 'result') throw new Error('not created');
    const { participantId } = second.value as { participantId: number };
    expect(await host.handle(call('setParticipantColor', [participantId, 'violet']))).toMatchObject({ type: 'result', value: { changed: false, reason: 'taken' } });
  });

  it('an unknown connection or person → `connection` with the name only; the message never crosses', async () => {
    const host = hostOn(db);
    const r = await host.handle(call('renameParticipant', [999, 'Хтось']));
    expect(r).toEqual({ type: 'failure', id: ids, code: 'connection', name: 'ConnectionError' });
    expect(await host.handle(call('connectionAccounts', [999]))).toMatchObject({ type: 'failure', code: 'connection' });
  });

  it('any other error → `failed` with its name; nothing of its message', async () => {
    const broken: Db = {
      execute: async () => {
        throw new TypeError('CANARY-secret-detail');
      },
      batch: async () => undefined,
      close: () => undefined,
    };
    const host = new DataHost({ open: async () => broken, release: async () => undefined, nowSec: () => 1_000, rates: async () => null });
    const r = await host.handle(call('status', []));
    expect(r).toMatchObject({ type: 'failure', code: 'failed', name: 'TypeError' });
    expect(JSON.stringify(r)).not.toContain('CANARY');
  });

  it('arguments are checked before anything runs', async () => {
    let executed = 0;
    const counting: Db = { ...db, execute: (s) => (executed++, db.execute(s)), batch: (s) => db.batch(s), close: () => undefined };
    const host = hostOn(counting);
    expect(await host.handle(call('deleteConnection', ['1; DROP TABLE accounts']))).toMatchObject({ type: 'failure', code: 'invalid' });
    expect(await host.handle(call('status', [1]))).toMatchObject({ type: 'failure', code: 'invalid' });
    expect(executed).toBe(0);
  });

  it('calls run one at a time, in the order they arrive; close waits for them', async () => {
    let executed = 0;
    const slow: Db = {
      execute: async (s) => {
        executed++;
        await new Promise((r) => setTimeout(r, 2));
        return db.execute(s);
      },
      batch: (s) => db.batch(s),
      close: () => undefined,
    };
    // How many statements `people` runs on its own.
    const alone = hostOn(slow);
    await alone.open();
    executed = 0;
    await alone.handle(call('people', []));
    const peopleAlone = executed;

    const host = hostOn(slow);
    await host.open();
    executed = 0;
    const order: string[] = [];
    let atFirstReply = -1;
    const first = host.handle(call('people', [])).then(() => {
      atFirstReply = executed;
      order.push('people');
    });
    const second = host.handle(call('status', [])).then(() => order.push('status'));
    const closed = host.close().then(() => order.push('close'));
    await Promise.all([first, second, closed]);
    expect(order).toEqual(['people', 'status', 'close']);
    expect(atFirstReply).toBe(peopleAlone);
  });
});

describe('dataApi', () => {
  it('a reply → its value; a failure → DataCallError with the code and the original name as its message', async () => {
    const api = dataApi(async (method, args) =>
      method === 'status' ? { type: 'result', id: 1, value: { hasData: true } } : { type: 'failure', id: 2, code: 'connection', name: `ConnectionError:${args.length}` },
    );
    expect(await api.status()).toEqual({ hasData: true });
    const err = await api.deleteConnection(5).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(DataCallError);
    expect(err).toMatchObject({ code: 'connection', name: 'ConnectionError:1', message: 'ConnectionError:1' });
  });
});
