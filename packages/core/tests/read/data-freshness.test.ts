// How far the data reaches when banks are updated differently (spec desktop-data-freshness): token connections decide
// completeness, a statement file never holds them back; with files only, every account counts. Invented data only.
import { describe, expect, it } from 'vitest';
import type { Db } from '../../src/storage/db.ts';
import { addConnection, addParticipant } from '../../src/people/participants.ts';
import { periodInfo } from '../../src/read/filters.ts';
import { getSyncStatus } from '../../src/read/status.ts';
import { insertAccountRow, memoryDb } from '../helpers.ts';

const DAY = 86_400;
const TODAY = Date.UTC(2026, 9, 25, 9) / 1000; // 25.10.2026, 12:00 Kyiv
const SEPT_21 = Date.UTC(2026, 8, 21, 9) / 1000;
const OCT = { from: '2026-10-01', to: '2026-10-31' };

async function account(db: Db, id: string, connection: number, newest: number): Promise<void> {
  await insertAccountRow(db, { id, kind: 'card', currency_code: 980, balance: 0, updated_at: 0, connection_id: connection });
  await db.execute({ sql: 'INSERT INTO sync_state VALUES (?, ?, ?, ?)', args: [id, newest - 30 * DAY, newest, newest] });
}

async function setup(withToken: boolean) {
  const db = await memoryDb();
  const me = await addParticipant(db, { label: 'Вигадана Особа' }, 0);
  if (withToken) await account(db, 'mono', await addConnection(db, me, 'monobank', 0, 'token'), TODAY);
  await account(db, 'privat', await addConnection(db, me, 'privatbank', 0, 'file'), SEPT_21);
  return db;
}

describe('data freshness', () => {
  it('a token bank and an older statement file: complete up to the token bank\'s date', async () => {
    const db = await setup(true);
    expect((await periodInfo(db, OCT, TODAY)).dataUntil).toBe('2026-10-25');
    expect((await getSyncStatus(db, TODAY * 1000)).data_until).toBe('2026-10-25');
  });

  it('files only: the oldest date any of them reaches', async () => {
    const db = await setup(false);
    expect((await periodInfo(db, OCT, TODAY)).dataUntil).toBe('2026-09-21');
    expect((await getSyncStatus(db, TODAY * 1000)).data_until).toBe('2026-09-21');
  });
});
