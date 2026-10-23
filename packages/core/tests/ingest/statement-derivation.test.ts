// A statement upload relies on its window's derivation pass: no full pass after it, unless that pass failed.
// Separate file: vi.mock wraps src/derive/rederive.ts for every test in the file. Invented data only.
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Db } from '../../src/storage/db.ts';
import { addConnection, addParticipant } from '../../src/people/participants.ts';
import { monobankCardReader } from '../../src/providers/monobank/statement.ts';
import * as rederive from '../../src/derive/rederive.ts';
import { commitStatement } from '../../src/ingest/statement-import.ts';
import { derivedColumns, insertAccountRow, insertTransactionRow, memoryDb, testConnection } from '../helpers.ts';

const failNext = vi.hoisted(() => ({ value: false }));
vi.mock('../../src/derive/rederive.ts', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../src/derive/rederive.ts')>();
  return {
    ...real,
    rederiveCore: vi.fn(real.rederiveCore),
    deriveSpan: vi.fn(async (...args: Parameters<typeof real.deriveSpan>) => {
      if (failNext.value) {
        failNext.value = false;
        throw new Error('derivation exploded');
      }
      return real.deriveSpan(...args);
    }),
  };
});

let db: Db;
beforeEach(() => {
  vi.mocked(rederive.rederiveCore).mockClear();
});
afterEach(() => db?.close());

async function upload(): Promise<void> {
  db = await memoryDb();
  const conn = await addConnection(db, await addParticipant(db, { label: 'Вигадана Особа' }, 0), 'monobank', 0, 'file');
  const r = monobankCardReader.read({ format: 'text', text: readFileSync(new URL('../providers/monobank/fixtures/statement-card-uk.csv', import.meta.url), 'utf8') });
  if (!r.ok) throw new Error(r.problem);
  await commitStatement(db, conn, r.statements, [{ kind: 'new', id: 'file-card', type: 'black' }], 999);
}

/** The stored values, then a full pass on the same file: nothing may move. */
async function equalsFullPass(): Promise<void> {
  const stored = await derivedColumns(db);
  await rederive.rederiveCore(db);
  expect(await derivedColumns(db)).toEqual(stored);
}

describe('commitStatement and the full pass', () => {
  it('its window derived: no full pass, and the values equal one', async () => {
    await upload();
    expect(rederive.rederiveCore).not.toHaveBeenCalled();
    expect((await derivedColumns(db)).every((r) => r.category !== null)).toBe(true);
    await equalsFullPass();
  });

  it('its window failed to derive: one full pass before the upload returns', async () => {
    failNext.value = true;
    await upload();
    expect(rederive.rederiveCore).toHaveBeenCalledTimes(1);
    await equalsFullPass();
  });
});

describe('a statement that brings an IBAN', () => {
  it("runs the full pass: another account's old row naming that IBAN becomes an own transfer", async () => {
    db = await memoryDb();
    const token = await testConnection(db);
    const me = Number((await db.execute({ sql: 'SELECT participant_id FROM connections WHERE id = ?', args: [token] })).rows[0]?.participant_id);
    const iban = 'UA003000000000000000000000001';
    const T = Math.floor(Date.parse('2026-01-15T12:00:00+02:00') / 1000);
    await insertAccountRow(db, { id: 'api-card', connection_id: token, kind: 'card', type: 'black', currency_code: 980, balance: 0, updated_at: T });
    await insertTransactionRow(db, {
      id: 'out-1', account_id: 'api-card', time: T, local_date: '2026-01-15', description: 'Вигаданий переказ', mcc: 4829, hold: 0,
      amount: -5000, currency_code: 980, counter_iban: iban, synced_at: 0,
    });
    await rederive.rederiveCore(db);
    vi.mocked(rederive.rederiveCore).mockClear();
    const rule = async () => (await db.execute("SELECT transfer_rule, is_internal_transfer FROM transactions WHERE id = 'out-1'")).rows.map((r) => ({ ...r }));
    expect(await rule()).toEqual([{ transfer_rule: null, is_internal_transfer: 0 }]);

    // The file is months later: its own window pass never reaches the old row.
    const file = await addConnection(db, me, 'monobank', 0, 'file');
    const t = Math.floor(Date.parse('2026-10-01T10:00:00+03:00') / 1000);
    await commitStatement(
      db,
      file,
      [{ kind: 'card', currencyCode: 980, account: { iban, cards: [], type: null }, rows: [{ time: t, amount: 5000, currencyCode: 980, hold: false, raw: '{}' }], closingBalance: 5000 }],
      [{ kind: 'new', id: 'file-card', type: null }],
      1,
    );
    expect(rederive.rederiveCore).toHaveBeenCalledTimes(1);
    expect(await rule()).toEqual([{ transfer_rule: 'iban', is_internal_transfer: 1 }]);
    await equalsFullPass();
  });
});
