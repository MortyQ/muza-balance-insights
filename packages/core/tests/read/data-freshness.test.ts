// How far the data reaches when banks are updated differently (spec desktop-data-freshness): token connections decide
// completeness, a statement file never holds them back; with files only, every account counts. Invented data only.
import { describe, expect, it } from 'vitest';
import type { Db } from '../../src/storage/db.ts';
import { addConnection, addParticipant } from '../../src/people/participants.ts';
import { periodInfo } from '../../src/read/filters.ts';
import { getSyncStatus } from '../../src/read/status.ts';
import { insertAccountRow, insertTransactionRow, memoryDb } from '../helpers.ts';

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

// A bank view (spec core-bank-view): the same rule among the chosen banks' accounts; the status stays every bank's.
describe('data freshness of a bank view', () => {
  it('only the statement bank chosen: complete up to its own date', async () => {
    const db = await setup(true);
    const info = await periodInfo(db, { ...OCT, providers: ['privatbank'] }, TODAY);
    expect(info).toMatchObject({ dataUntil: '2026-09-21', incomplete: true, coveredDays: 0 });
    expect((await getSyncStatus(db, TODAY * 1000)).data_until).toBe('2026-10-25');
  });

  it('a token bank among the chosen decides', async () => {
    const db = await setup(true);
    expect((await periodInfo(db, { ...OCT, providers: ['monobank', 'privatbank'] }, TODAY)).dataUntil).toBe('2026-10-25');
  });

  it('pending holds of the chosen banks only', async () => {
    const db = await setup(true);
    await insertTransactionRow(db, {
      id: 'hold', account_id: 'mono', time: TODAY - 3_600, local_date: '2026-10-25', description: '', mcc: 5411, hold: 1,
      amount: -100, operation_amount: -100, currency_code: 980, commission_rate: 0, category: 'другое', synced_at: 0,
    });
    expect((await periodInfo(db, { ...OCT, providers: ['monobank'] }, TODAY)).pendingHolds).toBe(1);
    expect((await periodInfo(db, { ...OCT, providers: ['privatbank'] }, TODAY)).pendingHolds).toBe(0);
    expect((await periodInfo(db, OCT, TODAY)).pendingHolds).toBe(1);
  });
});
