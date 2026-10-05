// Periods in a time zone (periods.ts): rows match by `time` within the zone's days, so a purchase late in the evening in
// Berlin belongs to that Berlin day and month whatever `local_date` (the Kyiv date) says. No zone → Kyiv, as before.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Db } from '../src/db.ts';
import { startOfDayIn, toKyivDate } from '../src/format.ts';
import { exchangeRates } from '../src/fx.ts';
import { periodBuckets } from '../src/periods.ts';
import { searchTransactions } from '../src/search.ts';
import { SummaryError, incomeSummary, periodInfo, spendingSummary } from '../src/summaries.ts';
import { insertAccountRow, memoryDb } from './helpers.ts';

const BERLIN = 'Europe/Berlin';
/** 23:05 in Berlin on 30 Sep 2026 (CEST) — 00:05 on 1 Oct in Kyiv. */
const LATE_SEP30 = startOfDayIn('2026-09-30', BERLIN) + 23 * 3600 + 5 * 60;
/** 12:00 in Berlin on 15 Sep 2026: the same day in both zones. */
const MID_SEP15 = startOfDayIn('2026-09-15', BERLIN) + 12 * 3600;
const NOW = startOfDayIn('2026-10-20', BERLIN);

let db: Db;
let seq = 0;

async function tx(time: number, amount: number, o: { category?: string; account?: string; opCurrency?: number; opAmount?: number; rule?: string; description?: string } = {}) {
  await db.execute({
    sql: `INSERT INTO transactions (id, account_id, time, local_date, description, mcc, hold, amount, operation_amount, currency_code,
            category, transfer_rule, raw_json, synced_at) VALUES (?, ?, ?, ?, ?, 5411, 0, ?, ?, ?, ?, ?, '{}', 0)`,
    args: [`t${++seq}`, o.account ?? 'black', time, toKyivDate(time), o.description ?? '', amount, o.opAmount ?? amount, o.opCurrency ?? 980,
      o.category ?? 'продукты', o.rule ?? null],
  });
}

beforeEach(async () => {
  seq = 0;
  db = await memoryDb();
  await insertAccountRow(db, { id: 'black', kind: 'card', type: 'black', currency_code: 980, balance: 0, credit_limit: 0, updated_at: 0 });
  await db.execute({ sql: 'INSERT INTO sync_state VALUES (?, ?, ?, ?)', args: ['black', startOfDayIn('2026-01-01', BERLIN), LATE_SEP30, LATE_SEP30] });
});
afterEach(() => db.close());

const SEP = { from: '2026-09-01', to: '2026-09-30' };
const OCT = { from: '2026-10-01', to: '2026-10-31' };
const net = async (q: { from: string; to: string; tz?: string }) => (await spendingSummary(db, q, NOW)).totals.find((t) => t.currency === 980)?.net ?? 0;

describe('spending in the period’s zone', () => {
  it('23:05 in Berlin on the last day of September counts for September in Berlin, for October in Kyiv', async () => {
    await tx(MID_SEP15, -10_000);
    await tx(LATE_SEP30, -2_500);
    expect(await net({ ...SEP, tz: BERLIN })).toBe(12_500);
    expect(await net({ ...OCT, tz: BERLIN })).toBe(0);
    expect(await net(SEP)).toBe(10_000); // no zone → Kyiv, as before
    expect(await net(OCT)).toBe(2_500);
  });

  it('day and month keys are the zone’s days', async () => {
    await tx(LATE_SEP30, -2_500);
    const days = async (tz?: string) =>
      (await spendingSummary(db, { from: '2026-09-28', to: '2026-10-02', groupBy: 'day', ...(tz ? { tz } : {}) }, NOW)).groups.map((g) => g.key);
    expect(await days(BERLIN)).toEqual(['2026-09-30']);
    expect(await days()).toEqual(['2026-10-01']);
    const months = async (tz?: string) =>
      (await spendingSummary(db, { from: '2026-09-01', to: '2026-10-31', groupBy: 'month', ...(tz ? { tz } : {}) }, NOW)).groups.map((g) => g.key);
    expect(await months(BERLIN)).toEqual(['2026-09']);
    expect(await months()).toEqual(['2026-10']);
  });

  it('income by month follows the zone too', async () => {
    await tx(LATE_SEP30, 50_000, { category: 'поступления', description: 'Від: Вигадана Компанія' });
    const months = async (tz?: string) =>
      (await incomeSummary(db, { from: '2026-09-01', to: '2026-10-31', groupBy: 'month', ...(tz ? { tz } : {}) }, NOW)).groups.map((g) => [g.key, g.total]);
    expect(await months(BERLIN)).toEqual([['2026-09', 50_000]]);
    expect(await months()).toEqual([['2026-10', 50_000]]);
  });

  it('search finds the row on the zone’s day', async () => {
    await tx(LATE_SEP30, -2_500);
    expect((await searchTransactions(db, { from: '2026-09-30', to: '2026-09-30', tz: BERLIN }, NOW)).total).toBe(1);
    expect((await searchTransactions(db, { from: '2026-09-30', to: '2026-09-30' }, NOW)).total).toBe(0);
  });
});

describe('periodInfo in the zone', () => {
  it('the data reaches 30 Sep in Berlin, 1 Oct in Kyiv', async () => {
    expect((await periodInfo(db, { ...SEP, tz: BERLIN }, NOW)).dataUntil).toBe('2026-09-30');
    expect((await periodInfo(db, SEP, NOW)).dataUntil).toBe('2026-10-01');
  });

  it('an unknown zone is refused', async () => {
    await expect(periodInfo(db, { ...SEP, tz: 'Mars/Olympus' }, NOW)).rejects.toThrow(SummaryError);
  });
});

describe('DST', () => {
  it('the day the clocks go back is 25 hours long; a row late that evening stays on it', async () => {
    const buckets = JSON.parse(periodBuckets({ from: '2026-10-24', to: '2026-10-26', tz: BERLIN }, 'day')) as Array<[string, number, number]>;
    expect(buckets.map(([k, s, e]) => [k, e - s])).toEqual([['2026-10-24', 86_400], ['2026-10-25', 90_000], ['2026-10-26', 86_400]]);
    const late = startOfDayIn('2026-10-25', BERLIN) + 24 * 3600 + 30 * 60; // 23:30 CET: the 25th hour of the day
    await tx(late, -700);
    const s = await spendingSummary(db, { from: '2026-10-24', to: '2026-10-26', groupBy: 'day', tz: BERLIN }, NOW);
    expect(s.groups.map((g) => [g.key, g.net])).toEqual([['2026-10-25', 700]]);
  });

  it('month buckets are cut to the period', () => {
    const buckets = JSON.parse(periodBuckets({ from: '2026-09-15', to: '2026-10-10', tz: BERLIN }, 'month')) as Array<[string, number, number]>;
    expect(buckets).toEqual([
      ['2026-09', startOfDayIn('2026-09-15', BERLIN), startOfDayIn('2026-10-01', BERLIN)],
      ['2026-10', startOfDayIn('2026-10-01', BERLIN), startOfDayIn('2026-10-11', BERLIN)],
    ]);
  });
});

describe('exchangeRates in the zone', () => {
  it('an exchange at 23:05 in Berlin on 30 Sep is September’s in Berlin, only the nearest one in Kyiv', async () => {
    await insertAccountRow(db, { id: 'uah', kind: 'card', type: 'fop', currency_code: 980, balance: 0, credit_limit: 0, updated_at: 0 });
    await tx(LATE_SEP30, 400_000, { account: 'uah', opCurrency: 840, opAmount: 10_000, rule: 'pair_fx' });
    expect((await exchangeRates(db, { ...SEP, tz: BERLIN })).get(840)).toEqual({ rate: 40, nearest: false });
    expect((await exchangeRates(db, SEP)).get(840)).toEqual({ rate: 40, nearest: true });
  });
});
