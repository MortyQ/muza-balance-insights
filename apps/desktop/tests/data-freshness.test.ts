// The data status with banks updated differently (spec desktop-data-freshness): how far the data reaches is the token
// connections', a statement file never holds them back; with files only, every account counts. Invented data only.
import { afterEach, describe, expect, it } from 'vitest';
import { addConnection, addParticipant } from '@mono/core/people/participants';
import type { Db } from '@mono/core/storage/db';
import { insertAccountRow, memoryDb } from '@mono/core/test-helpers';
import { DataService } from '../src/data/data.ts';
import { inTimeZone } from './helpers/time-zone.ts';

const TODAY = Date.UTC(2026, 9, 25, 9) / 1000; // 11:00 in Kyiv (winter time from that night)
const SEPT_21 = Date.UTC(2026, 8, 21, 9) / 1000;

let db: Db;
afterEach(() => db?.close());

async function account(id: string, connection: number, newest: number): Promise<void> {
  await insertAccountRow(db, { id, kind: 'card', currency_code: 980, balance: 0, updated_at: 0, connection_id: connection });
  await db.execute({ sql: 'INSERT INTO sync_state VALUES (?, ?, ?, ?)', args: [id, newest - 86_400, newest, newest] });
}

async function status(withToken: boolean) {
  db = await memoryDb();
  const me = await addParticipant(db, { label: 'Вигадана Особа' }, 0);
  if (withToken) await account('mono', await addConnection(db, me, 'monobank', 0, 'token'), TODAY);
  await account('privat', await addConnection(db, me, 'privatbank', 0, 'file'), SEPT_21);
  const svc = new DataService({ open: async () => db, release: async () => undefined, nowSec: () => TODAY, rates: async () => null });
  return svc.status();
}

describe('DataService.status: how far the data reaches', () => {
  inTimeZone('Europe/Kyiv');

  it('a token bank and an older statement file: the token bank\'s date', async () => {
    expect((await status(true)).dataUntil).toBe('2026-10-25 11:00');
  });

  it('files only: the oldest file', async () => {
    expect((await status(false)).dataUntil).toBe('2026-09-21 12:00');
  });
});
