// Cash withdrawals and the `cash_is_spending` setting: on (the default) they are spending; off every spending read
// leaves their bodies out like own transfers, the commission stays; `cashWithdrawn` counts them either way. Fictional
// data only.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Db } from '../../src/storage/db.ts';
import { CATEGORY } from '../../src/derive/categories.ts';
import { getSettings, setSetting } from '../../src/people/settings.ts';
import { kyivStartOfDay, toKyivDate } from '../../src/shared/format.ts';
import { categoryLines } from '../../src/read/category-lines.ts';
import { cashWithdrawn, spendingGrid, spendingSummary } from '../../src/read/spending.ts';
import { insertAccount, insertTransactionRow, memoryDb } from '../helpers.ts';

let db: Db;
const NOW = kyivStartOfDay('2026-10-28');
const MONTH = { from: '2026-10-01', to: '2026-10-31', tz: 'Europe/Kyiv' } as const;

async function tx(id: string, day: string, amount: number, category: string, mcc: number, commission = 0) {
  const time = kyivStartOfDay(day) + 3600;
  await insertTransactionRow(db, {
    id, account_id: 'black', time, local_date: toKyivDate(time), description: 'Fictional', mcc, hold: 0,
    amount, operation_amount: amount, currency_code: 980, commission_rate: commission, category, synced_at: 0,
  });
}

beforeEach(async () => {
  db = await memoryDb();
  await insertAccount(db, 'black');
  await tx('food', '2026-10-03', -100_000, CATEGORY.groceries, 5411);
  // 2 000 ₴ withdrawn with a 20 ₴ commission: the row's amount includes it.
  await tx('atm', '2026-10-05', -202_000, CATEGORY.cash, 6010, 2_000);
  await tx('atm2', '2026-10-07', -50_000, CATEGORY.cash, 6010);
});
afterEach(() => db.close());

const byKey = async () => Object.fromEntries((await spendingSummary(db, { ...MONTH, groupBy: 'category' }, NOW)).groups.map((g) => [g.key, g.net]));

describe('cash withdrawals as spending', () => {
  it('on by default: cash is a spending category, the commission its own line', async () => {
    expect((await getSettings(db)).cash_is_spending).toBe(true);
    expect(await byKey()).toEqual({ [CATEGORY.groceries]: 100_000, [CATEGORY.cash]: 250_000, [CATEGORY.fees]: 2_000 });
  });

  it('off: no «Cash» in any spending read; the commission stays; on again restores everything', async () => {
    const before = await byKey();
    await setSetting(db, 'cash_is_spending', 'off');
    expect(await byKey()).toEqual({ [CATEGORY.groceries]: 100_000, [CATEGORY.fees]: 2_000 });
    const grid = await spendingGrid(db, { ...MONTH, unit: 'day' }, NOW);
    expect(grid.cells.some((c) => c.category === CATEGORY.cash)).toBe(false);
    expect(grid.cells.reduce((a, c) => a + c.net, 0)).toBe(102_000);
    const people = await spendingSummary(db, { ...MONTH, groupBy: 'participant' }, NOW);
    expect(people.totals[0]?.net).toBe(102_000);
    const banks = await spendingGrid(db, { ...MONTH, unit: 'month', byProvider: true }, NOW);
    expect(banks.cells.reduce((a, c) => a + c.net, 0)).toBe(102_000);
    expect((await categoryLines(db, { ...MONTH, category: CATEGORY.cash }, NOW)).lines).toEqual([]);
    await setSetting(db, 'cash_is_spending', 'on');
    expect(await byKey()).toEqual(before);
  });

  it('cashWithdrawn: the net withdrawn without the commission, whatever the setting', async () => {
    expect(await cashWithdrawn(db, MONTH, NOW)).toEqual([{ currency: 980, net: 250_000 }]);
    await setSetting(db, 'cash_is_spending', 'off');
    expect(await cashWithdrawn(db, MONTH, NOW)).toEqual([{ currency: 980, net: 250_000 }]);
    expect(await cashWithdrawn(db, { ...MONTH, from: '2026-10-06' }, NOW)).toEqual([{ currency: 980, net: 50_000 }]);
  });
});
