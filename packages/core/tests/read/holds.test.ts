// The `holds` spending filter: pending holds (the last RESYNC_OVERLAP_SEC) left out or kept alone; an older hold is
// final. Fictional data only.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Db } from '../../src/storage/db.ts';
import { RESYNC_OVERLAP_SEC } from '../../src/shared/constants.ts';
import { kyivStartOfDay, toKyivDate } from '../../src/shared/format.ts';
import { categoryLines } from '../../src/read/category-lines.ts';
import { spendingGrid, spendingSummary } from '../../src/read/spending.ts';
import { insertAccount, insertTransactionRow, memoryDb } from '../helpers.ts';

let db: Db;
const DAY = 86_400;
/** «Now»: noon on 20 Oct 2026, Kyiv. */
const NOW = kyivStartOfDay('2026-10-20') + DAY / 2;
const MONTH = { from: '2026-10-01', to: '2026-10-31', tz: 'Europe/Kyiv' } as const;

async function tx(id: string, time: number, amount: number, hold: boolean, commission = 0) {
  await insertTransactionRow(db, {
    id, account_id: 'black', time, local_date: toKyivDate(time), description: 'Fictional cafe', mcc: 5814, hold: hold ? 1 : 0,
    amount, operation_amount: amount, currency_code: 980, commission_rate: commission, category: 'кафе и рестораны', synced_at: 0,
  });
}

beforeEach(async () => {
  db = await memoryDb();
  await insertAccount(db, 'black');
  await tx('final', NOW - 10 * DAY, -10_000, false);
  await tx('old-hold', NOW - 5 * DAY, -20_000, true);
  await tx('fresh-hold', NOW - 3600, -40_000, true, 400);
});
afterEach(() => db.close());

const net = async (holds?: 'all' | 'final' | 'pending') =>
  (await spendingSummary(db, { ...MONTH, ...(holds ? { holds } : {}) }, NOW)).totals[0]?.net ?? 0;

describe('holds filter', () => {
  it("'all' (the default) counts every operation, as before", async () => {
    expect(RESYNC_OVERLAP_SEC).toBeLessThan(5 * DAY);
    expect(await net()).toBe(70_000);
    expect(await net('all')).toBe(70_000);
  });

  it("'final' leaves out the fresh hold and keeps the 5-day-old one", async () => {
    expect(await net('final')).toBe(30_000);
  });

  it("'pending' counts only the fresh hold, its commission as its own line", async () => {
    const s = await spendingSummary(db, { ...MONTH, holds: 'pending' }, NOW);
    expect(s.totals[0]?.net).toBe(40_000);
    expect(Object.fromEntries(s.groups.map((g) => [g.key, g.net]))).toEqual({ 'кафе и рестораны': 39_600, 'комиссии банка': 400 });
  });

  it('the day grid follows the same rule, and final + pending add up to all', async () => {
    const sum = async (holds: 'all' | 'final' | 'pending') =>
      (await spendingGrid(db, { ...MONTH, unit: 'day', holds }, NOW)).cells.reduce((a, c) => a + c.net, 0);
    expect(await sum('final')).toBe(30_000);
    expect(await sum('pending')).toBe(40_000);
    expect((await sum('final')) + (await sum('pending'))).toBe(await sum('all'));
  });

  it('an unknown value is refused', async () => {
    await expect(spendingSummary(db, { ...MONTH, holds: 'some' as 'all' }, NOW)).rejects.toThrow(/holds/);
  });

  it('the category screen keeps listing every operation', async () => {
    const lines = await categoryLines(db, { ...MONTH, category: 'кафе и рестораны' }, NOW);
    expect(lines.lines.length).toBeGreaterThanOrEqual(3);
  });
});
