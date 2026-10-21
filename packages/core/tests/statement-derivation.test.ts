// A statement upload relies on its window's derivation pass: no full pass after it, unless that pass failed.
// Separate file: vi.mock wraps src/rederive.ts for every test in the file. Invented data only.
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Db } from '../src/storage/db.ts';
import { addConnection, addParticipant } from '../src/participants.ts';
import { monobankStatement } from '../src/providers/monobank/statement.ts';
import * as rederive from '../src/rederive.ts';
import { commitStatement } from '../src/statement-import.ts';
import { derivedColumns, memoryDb } from './helpers.ts';

const failNext = vi.hoisted(() => ({ value: false }));
vi.mock('../src/rederive.ts', async (importOriginal) => {
  const real = await importOriginal<typeof import('../src/rederive.ts')>();
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
  const r = monobankStatement.parse(readFileSync(new URL('./providers/monobank/fixtures/statement-card-uk.csv', import.meta.url), 'utf8'));
  if (!r.ok) throw new Error(r.problem);
  await commitStatement(db, conn, r.statement, { kind: 'new', id: 'file-card', type: 'black' }, 999);
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
