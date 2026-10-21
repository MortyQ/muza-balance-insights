// Query plans of the main statistics: a period reads operations through an index on time (or account and time), never
// by a full scan of the operations table. Every statement a statistic runs is captured and EXPLAINed. Plans do not depend
// on timing, so this is the deterministic guard behind the benchmark (bench/). Fictional data only (bench/generate.ts).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_BENCH, generateDataset, loadDataset } from '../bench/generate.ts';
import type { Db, Stmt } from '../src/storage/db.ts';
import { categoryLines } from '../src/category-lines.ts';
import { startOfDayIn } from '../src/shared/format.ts';
import { incomeLines } from '../src/income-lines.ts';
import { findRecurring } from '../src/recurring.ts';
import { rederiveCore } from '../src/derive/rederive.ts';
import { searchTransactions } from '../src/search.ts';
import { balancesAt } from '../src/status.ts';
import { comparePeriods, incomeSummary, spendingGrid, spendingSummary } from '../src/summaries.ts';
import { openTestDb } from './helpers.ts';

const TZ = 'Europe/Kyiv';
const MONTH = { from: '2026-09-01', to: '2026-09-30', tz: TZ };
const PREV = { from: '2026-08-01', to: '2026-08-31', tz: TZ };
const YEAR = { from: '2025-10-01', to: '2026-09-30', tz: TZ };
const opts = { ...DEFAULT_BENCH, operations: 2_000 };
const NOW = opts.endSec;

let db: Db;
beforeAll(async () => {
  db = await openTestDb(':memory:');
  await loadDataset(db, generateDataset(opts));
  await rederiveCore(db);
});
afterAll(() => db?.close());

/** Runs `fn` on a Db that records every statement it executes. */
async function captured(fn: (d: Db) => Promise<unknown>): Promise<Stmt[]> {
  const seen: Stmt[] = [];
  const spy: Db = {
    execute: (s) => (seen.push(s), db.execute(s)),
    batch: (ss) => (seen.push(...ss), db.batch(ss)),
    close: () => undefined,
  };
  await fn(spy);
  return seen;
}

/** The plan lines of the statements that read `transactions`. */
async function plans(stmts: readonly Stmt[]): Promise<string[]> {
  const out: string[] = [];
  for (const s of stmts) {
    const { sql, args } = typeof s === 'string' ? { sql: s, args: [] } : { sql: s.sql, args: s.args ?? [] };
    if (!/\btransactions\b/.test(sql)) continue;
    const rs = await db.execute({ sql: `EXPLAIN QUERY PLAN ${sql}`, args });
    out.push(...rs.rows.map((r) => String(r.detail)));
  }
  return out;
}

// A full pass over the operations, whatever the alias: `SCAN t`, `SCAN transactions`, also «USING (COVERING) INDEX»;
// and an automatic index on them, which SQLite builds by reading the whole table first.
const FULL_SCAN = /^(SCAN (t|transactions|pt|tt)\b|SEARCH (t|transactions|pt|tt) USING AUTOMATIC)/;

const CASES: Record<string, (d: Db) => Promise<unknown>> = {
  'one month of spending by category': (d) => spendingSummary(d, { ...MONTH, groupBy: 'category' }, NOW),
  'one month of spending of one person, personal scope': (d) => spendingSummary(d, { ...MONTH, participantId: 1, scope: 'personal', groupBy: 'category' }, NOW),
  'twelve months of spending by month': (d) => spendingSummary(d, { ...YEAR, groupBy: 'month' }, NOW),
  'twelve months of spending by day (grid)': (d) => spendingGrid(d, { ...YEAR, unit: 'day' }, NOW),
  'compare two months': (d) => comparePeriods(d, { a: PREV, b: MONTH, groupBy: 'category' }, NOW),
  'one month of income by source': (d) => incomeSummary(d, { ...MONTH }, NOW),
  'twelve months of income by day': (d) => incomeSummary(d, { ...YEAR, groupBy: 'day' }, NOW),
  'search in a year': (d) => searchTransactions(d, { ...YEAR, text: 'bench', limit: 50 }, NOW),
  'the lines of a category': (d) => categoryLines(d, { ...MONTH, category: 'продукты' }, NOW),
  'the lines of income': (d) => incomeLines(d, { ...MONTH }, NOW),
  'regular payments over a year': (d) => findRecurring(d, { ...YEAR }, NOW),
  'balances at a month end, family and one person': async (d) => {
    await balancesAt(d, { endSec: startOfDayIn('2026-10-01', TZ) });
    await balancesAt(d, { endSec: startOfDayIn('2026-09-01', TZ), participantId: 2 });
  },
};

describe('query plans: no full scan of the operations', () => {
  it('control: the check sees a full scan when a statement has one', async () => {
    expect((await plans(["SELECT COUNT(*) FROM transactions t WHERE t.description = 'x'"])).some((l) => FULL_SCAN.test(l))).toBe(true);
    expect(FULL_SCAN.test('SEARCH t USING AUTOMATIC PARTIAL COVERING INDEX (is_cancelled=?)')).toBe(true);
    expect((await plans(['SELECT COUNT(*) FROM transactions t WHERE t.time >= 1 AND t.time < 2'])).some((l) => FULL_SCAN.test(l))).toBe(false);
  });

  it.each(Object.entries(CASES))('%s', async (_name, fn) => {
    const stmts = await captured(fn);
    const lines = await plans(stmts);
    expect(lines.length).toBeGreaterThan(0);
    expect(lines.filter((l) => FULL_SCAN.test(l))).toEqual([]);
  });

  it('period statistics read operations by the time index; buckets are the outer loop of the range join', async () => {
    const lines = await plans(await captured(CASES['twelve months of spending by day (grid)']!));
    const byTime = /^SEARCH t USING INDEX idx_tx_time \(time>\? AND time<\?\)/;
    expect(lines.some((l) => byTime.test(l))).toBe(true);
    const order = lines.filter((l) => /^SCAN b\b/.test(l) || byTime.test(l));
    expect(order[0]).toMatch(/^SCAN b\b/);
  });
});
