// The performance harness: fictional data (bench/generate.ts) in an encrypted file, as the desktop stores it; each
// case timed as the best of several runs and checked against bench/budgets.ts. Exits 1 when a case is over budget.
// Run: pnpm --filter @mono/core bench [-- --plain] [-- --ops N]. Not part of `pnpm test`: timings depend on the machine.
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openLibsql } from '@mono/db-libsql';
import type { Db } from '../src/storage/db.ts';
import { rederiveCore, rederiveSpans } from '../src/derive/rederive.ts';
import { balancesAt } from '../src/read/status.ts';
import { startOfDayIn } from '../src/shared/format.ts';
import { incomeSummary } from '../src/read/income.ts';
import { spendingGrid, spendingSummary } from '../src/read/spending.ts';
import { BUDGETS_MS, type BenchCase } from './budgets.ts';
import { DEFAULT_BENCH, generateDataset, loadDataset } from './generate.ts';

const TZ = 'Europe/Kyiv';
const MONTH = { from: '2026-09-01', to: '2026-09-30', tz: TZ };
const PREV = { from: '2026-08-01', to: '2026-08-31', tz: TZ };
const YEAR = { from: '2025-10-01', to: '2026-09-30', tz: TZ };
// The six usual months before the shown one (main/usual.ts), as one span.
const USUAL = { from: '2026-03-01', to: '2026-08-31', tz: TZ };
const PEOPLE = [undefined, 1, 2] as const;

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const CASES: Record<BenchCase, { runs: number; fn: (db: Db, now: number) => Promise<unknown> }> = {
  'month by category': { runs: 5, fn: (db, now) => spendingSummary(db, { ...MONTH, groupBy: 'category' }, now) },
  'month income by source': { runs: 5, fn: (db, now) => incomeSummary(db, { ...MONTH }, now) },
  '12 months by month': { runs: 3, fn: (db, now) => spendingSummary(db, { ...YEAR, groupBy: 'month' }, now) },
  '12 months by day': { runs: 3, fn: (db, now) => spendingGrid(db, { ...YEAR, unit: 'day' }, now) },
  // What the desktop's «Spending» block asks of the core (main/data.ts spendingOverview): the month and the one before
  // for the family and each person, then the usual months' spending by month in one grid and their income with this
  // month's in one query by month.
  'spending block set': {
    runs: 2,
    fn: async (db, now) => {
      for (const p of PEOPLE) {
        const f = p === undefined ? {} : { participantId: p };
        await spendingSummary(db, { ...MONTH, ...f, groupBy: 'category', scope: 'personal' }, now);
        await spendingSummary(db, { ...PREV, ...f, groupBy: 'category', scope: 'personal' }, now);
      }
      await spendingGrid(db, { ...USUAL, unit: 'month', scope: 'personal' }, now);
      await incomeSummary(db, { ...USUAL, to: MONTH.to, groupBy: 'month', scope: 'personal' }, now);
    },
  },
  // The month overview's balances: the month's end and start, for the family and each person.
  'balances at two instants': {
    runs: 3,
    fn: async (db) => {
      for (const endSec of [startOfDayIn('2026-10-01', TZ), startOfDayIn('2026-09-01', TZ)]) {
        for (const p of PEOPLE) await balancesAt(db, { endSec, ...(p === undefined ? {} : { participantId: p }) });
      }
    },
  },
  'full re-derivation': { runs: 2, fn: (db) => rederiveCore(db) },
  // The end of a routine auto-sync (worker/run-import.ts): each account re-read its last window up to now, so the
  // touched spans merge into the last 31 days.
  'end of a routine auto-sync': { runs: 3, fn: (db, now) => rederiveSpans(db, [{ from: now - 31 * 86_400, to: now }]) },
};

async function main(): Promise<void> {
  const encrypted = !process.argv.includes('--plain');
  const options = { ...DEFAULT_BENCH, operations: Number(arg('--ops') ?? DEFAULT_BENCH.operations) };
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mono-bench-'));
  const file = path.join(dir, 'bench.sqlite');
  const db = await openLibsql(`file:${file}`, encrypted ? { encryptionKey: crypto.randomBytes(32).toString('hex') } : {});
  try {
    const ds = generateDataset(options);
    await loadDataset(db, ds);
    await rederiveCore(db);
    const sizeMb = fs.statSync(file).size / 1e6;
    console.log(
      `${ds.transactions.length} operations, ${options.days} days, payload ${options.payloadBytes} B, ` +
        `${encrypted ? 'encrypted' : 'plain'} file ${sizeMb.toFixed(1)} MB`,
    );
    console.log(`${'case'.padEnd(28)} ${'ms'.padStart(9)} ${'budget'.padStart(9)}`);
    const over: string[] = [];
    for (const [name, c] of Object.entries(CASES) as Array<[BenchCase, (typeof CASES)[BenchCase]]>) {
      let best = Infinity;
      for (let i = 0; i < c.runs; i++) {
        const t0 = performance.now();
        await c.fn(db, options.endSec);
        best = Math.min(best, performance.now() - t0);
      }
      const budget = BUDGETS_MS[name];
      const ok = best <= budget;
      if (!ok) over.push(`${name}: ${best.toFixed(1)} ms > ${budget} ms`);
      console.log(`${name.padEnd(28)} ${best.toFixed(1).padStart(9)} ${String(budget).padStart(9)}${ok ? '' : '  OVER'}`);
    }
    if (over.length > 0) {
      console.error(`Over budget:\n  ${over.join('\n  ')}`);
      process.exitCode = 1;
    }
  } finally {
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

await main();
