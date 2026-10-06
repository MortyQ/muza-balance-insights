# Analytics Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/analytics` shows, for a picked month or range of months and a person (or the family): four KPIs, the
«Income and spending» chart with «What changed» beside it, and a «Categories» block with four views (heatmap, small
charts, lines, compare); a period picker that picks one month or a range replaces the month button while it is open.

**Architecture:** Core gets `spendingGrid` (category × day/month in one query over `spendingLinesSql`) and
`incomeSummary` `groupBy: 'day'`. Main gets pure helpers (`main/analytics.ts`) and `DataService.analyticsOverview`, one
IPC method `getAnalyticsOverview({ from, to, participantId? })`. The renderer gets `VMonthRangePicker` (shared/ui, on
reka-ui), `useRangeStore` + `PeriodRangeFilter` (entities/period), a route meta switch in the global filters, and the
feature `features/analytics-overview` (pure view builders in `utils.ts`, ECharts options, five components).

**Tech Stack:** TypeScript, libsql (core), Electron main, zod, Vue 3.5 + Pinia + vue-router, reka-ui, ECharts 6
(`LineChart`, `CustomChart` added), vue-i18n, Vitest (+ happy-dom).

**Spec:** `docs/superpowers/specs/2026-10-06-analytics-design.md`. Mockups: the «Analytics screen concepts» canvas,
boards «Итог · страница» and «Итог · выбор периода».

**Rules that apply to every task** (from `CLAUDE.md`):
- Branch `feat/analytics` from `main` (Task 1, step 0). Do not push.
- English only in code, comments, docs, commits. UI texts only via i18n keys: a new key goes into `uk.json` (the
  reference), `en.json`, `ru.json` in the same change; `tests/i18n.test.ts` checks keys, placeholders and plural forms
  (copy the plural shape of an existing key, e.g. `category.where.more`).
- Fictional fixtures only.
- Tests: from `apps/desktop` — `pnpm --config.verify-deps-before-run=false exec vitest run <file>`; core — from
  `packages/core` the same. Renderer types — `pnpm --config.verify-deps-before-run=false exec vue-tsc -p tsconfig.web.json --noEmit`
  (from `apps/desktop`). Full checks at the root: `pnpm --config.verify-deps-before-run=false test` and
  `pnpm --config.verify-deps-before-run=false typecheck`.
- Run shell commands one at a time (no `cd … && git …` chains). Commit with `git commit -q -F - <<'EOF' … EOF`; the
  message ends with `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.
- No trust anchor is touched by this plan.

---

## File map

| File | Change |
|---|---|
| `packages/core/src/summaries.ts` | + `spendingGrid`, `SpendingCell`, `SpendingGrid`; `incomeSummary` `groupBy: 'day'` (Task 1) |
| `packages/core/tests/summaries.test.ts` | (Task 1) |
| `apps/desktop/src/shared/analytics.ts` | **new**: `ANALYTICS_MAX_MONTHS`, `monthSpan`, `addMonths` (Task 2) |
| `apps/desktop/src/shared/api.ts` | `AnalyticsQuery`, `AnalyticsOverview`, … ; `getAnalyticsOverview` (Task 2) |
| `apps/desktop/src/main/analytics.ts` | **new**: pure helpers (Task 2) |
| `apps/desktop/tests/analytics-main.test.ts` | **new** (Task 2) |
| `apps/desktop/src/main/data.ts` | `analyticsOverview` (Task 3) |
| `apps/desktop/tests/data.test.ts` | (Task 3) |
| `apps/desktop/src/shared/channels.ts`, `src/main/ipc.ts`, `src/main/index.ts`, `tests/ipc.test.ts` | (Task 4) |
| `apps/desktop/src/renderer/src/shared/ui/components/inputs/VMonthRangePicker.vue` + `styles/components/inputs/vmonthrangepicker.scss` | **new** (Task 5) |
| `apps/desktop/src/renderer/src/shared/ui/index.ts`, `shared/ui/README.md`, `tests/ui.test.ts` | (Task 5) |
| `apps/desktop/tests/renderer/month-range-picker.test.ts` | **new** (Task 5) |
| `apps/desktop/src/renderer/src/entities/period/*` | `useRangeStore`, `rangePresets`, `PeriodRangeFilter` (Task 6) |
| `apps/desktop/src/renderer/src/app/layouts/types.ts`, `app/router/routes.ts`, `widgets/global-filters/GlobalFilters.vue` | (Task 6) |
| `apps/desktop/tests/renderer/period.test.ts`, `tests/renderer/global-filters.test.ts` | (Task 6) |
| `apps/desktop/src/renderer/src/shared/ui/components/charts/echarts.ts` | + `LineChart`, `CustomChart` (Task 7) |
| `apps/desktop/src/renderer/src/features/analytics-overview/*` | **new** feature (Tasks 8–10) |
| `apps/desktop/tests/renderer/analytics.test.ts` | **new** (Tasks 8–10) |
| `apps/desktop/src/renderer/src/pages/analytics/AnalyticsPage.vue` | the feature instead of the placeholder (Task 10) |
| `apps/desktop/src/shared/i18n/{uk,en,ru}.json` | Tasks 5, 6, 8–10 (and `analytics.placeholder.*` removed in Task 10) |
| `CHANGELOG.md`, `.agents/project/desktop-renderer.md`, `.agents/project/desktop-import.md`, `.agents/project/domain-rules.md`, `CLAUDE.md`, `docs/backlog.md` | Task 11 |

---

### Task 1: Core — `spendingGrid` and income by day

**Files:**
- Modify: `packages/core/src/summaries.ts` (after `spendingSummary`; `IncomeGroupBy`, `incomeSummary`)
- Test: `packages/core/tests/summaries.test.ts`

- [ ] **Step 0: Branch**

Run: `git switch -c feat/analytics`

- [ ] **Step 1: Write the failing tests** (append to `summaries.test.ts`; uses its `account`, `tx`, `synced`, `NOW`)

```ts
describe('spendingGrid (category × day / month, the analytics screen)', () => {
  beforeEach(async () => {
    await account('uah', 'black');
    await account('usd', 'white', 840);
    await synced('uah');
    await synced('usd');
    await tx('uah', '2026-02-03', -20_000);
    await tx('uah', '2026-02-20', -5_000, { category: 'кафе и рестораны' });
    await tx('uah', '2026-03-02', -30_000);
    await tx('uah', '2026-03-05', -8_000, { category: 'кафе и рестораны' });
    await tx('uah', '2026-03-05', 2_000, { category: 'кафе и рестораны' }); // a refund
    await tx('uah', '2026-03-06', -1_000, { commission: 100 }); // body 900 + a «комиссии банка» line of 100
    await tx('usd', '2026-03-06', -100);
    await tx('uah', '2026-03-08', -5_000, { category: 'свои переводы', internal: true });
  });

  it('months: one cell per currency × month × category; refunds net out; commission is its own category', async () => {
    const g = await spendingGrid(db, { from: '2026-02-01', to: '2026-03-31', unit: 'month' }, NOW);
    expect(g.unit).toBe('month');
    expect(g.cells.map((c) => [c.currency, c.bucket, c.category, c.net])).toEqual([
      [840, '2026-03', 'продукты', 100],
      [980, '2026-02', 'кафе и рестораны', 5_000],
      [980, '2026-02', 'продукты', 20_000],
      [980, '2026-03', 'кафе и рестораны', 6_000],
      [980, '2026-03', 'комиссии банка', 100],
      [980, '2026-03', 'продукты', 30_900],
    ]);
    expect(g.cells.find((c) => c.bucket === '2026-03' && c.category === 'кафе и рестораны')).toMatchObject({ gross: 8_000, refunds: 2_000, purchases: 1 });
  });

  it('days: keys are the zone\'s dates; per currency the cells add up to spendingSummary by category', async () => {
    const g = await spendingGrid(db, { from: '2026-03-01', to: '2026-03-31', unit: 'day' }, NOW);
    expect([...new Set(g.cells.map((c) => c.bucket))].sort()).toEqual(['2026-03-02', '2026-03-05', '2026-03-06']);
    const s = await spendingSummary(db, { from: '2026-03-01', to: '2026-03-31', groupBy: 'category' }, NOW);
    for (const t of s.totals) {
      expect(g.cells.filter((c) => c.currency === t.currency).reduce((n, c) => n + c.net, 0)).toBe(t.net);
    }
  });

  it('refuses an unknown unit', async () => {
    await expect(spendingGrid(db, { from: '2026-03-01', to: '2026-03-31', unit: 'week' as 'day' }, NOW)).rejects.toThrow(SummaryError);
  });
});

describe('incomeSummary groupBy day (desktop only)', () => {
  it('one group per currency and local date', async () => {
    await account('uah', 'black');
    await synced('uah');
    await tx('uah', '2026-03-02', 40_000, { category: 'поступления', mcc: 4829 });
    await tx('uah', '2026-03-02', 10_000, { category: 'поступления', mcc: 4829 });
    await tx('uah', '2026-03-04', 5_000, { category: 'поступления', mcc: 4829 });
    const s = await incomeSummary(db, { from: '2026-03-01', to: '2026-03-31', groupBy: 'day' }, NOW);
    expect(s.groups.map((g) => [g.key, g.total, g.lines])).toEqual([['2026-03-02', 50_000, 2], ['2026-03-04', 5_000, 1]]);
  });

  it('is not offered to the MCP tools', () => {
    expect(INCOME_GROUP_BY).not.toContain('day');
  });
});
```

Add `spendingGrid` and `INCOME_GROUP_BY` to the import from `../src/summaries.ts`.

- [ ] **Step 2: Run, expect FAIL** — `spendingGrid` is not exported.

Run (from `packages/core`): `pnpm --config.verify-deps-before-run=false exec vitest run tests/summaries.test.ts`

- [ ] **Step 3: Implement** in `summaries.ts`, right after `spendingSummary`:

```ts
/** One cell of spendingGrid: one account currency, one day (YYYY-MM-DD) or month (YYYY-MM) of the period's zone, one category. */
export type SpendingCell = { currency: number; bucket: string; category: string; purchases: number; gross: number; refunds: number; net: number };
export type SpendingGrid = { period: PeriodInfo; unit: 'day' | 'month'; cells: SpendingCell[] };

/**
 * Spending by category × day or month of the period's zone in one query, over the lines of spendingSummary
 * (spendingLinesSql + SPENDING_LINE_SQL): per currency the cells add up to its groups by category, day or month.
 * For the desktop's analytics screen; the MCP tools do not offer it.
 */
export async function spendingGrid(db: Db, q: Period & SpendingFilters & { unit: 'day' | 'month' }, nowSec: number): Promise<SpendingGrid> {
  if (q.unit !== 'day' && q.unit !== 'month') throw new SummaryError(`unit: day | month, получено «${String(q.unit)}»`);
  validateFilters(q);
  const period = await periodInfo(db, q, nowSec);
  const from = await spendingLinesSql(db, q, q.unit);
  const rs = await db.execute({
    sql: `${from.sql}
          SELECT currency, ${bucketKeySql('time')} AS b, category,
                 SUM(CASE WHEN amount < 0 THEN 1 ELSE 0 END) AS purchases,
                 SUM(CASE WHEN amount < 0 THEN -amount ELSE 0 END) AS gross,
                 SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) AS refunds
          FROM lines
          WHERE ${SPENDING_LINE_SQL}
          GROUP BY currency, b, category
          ORDER BY currency, b, category`,
    args: [...from.args, ...SPENDING_LINE_ARGS],
  });
  const cells = rs.rows.map((r) => {
    const gross = Number(r.gross);
    const refunds = Number(r.refunds);
    return { currency: Number(r.currency), bucket: String(r.b), category: String(r.category), purchases: Number(r.purchases), gross, refunds, net: gross - refunds };
  });
  return { period, unit: q.unit, cells };
}
```

(The error text follows the module's existing Russian `SummaryError` messages; keep it in the same shape as the
`groupBy` ones above.)

Income by day — replace the `IncomeGroupBy` type and the check:

```ts
export const INCOME_GROUP_BY = ['source', 'month', 'account', 'scope'] as const;
/** Plus `day` — one group per date of the period's zone — for the desktop's analytics screen only: the MCP tools do not offer it. */
export type IncomeGroupBy = (typeof INCOME_GROUP_BY)[number] | 'day';
const INCOME_GROUPS: ReadonlyArray<IncomeGroupBy> = [...INCOME_GROUP_BY, 'day'];
```

In `incomeSummary`: `if (!INCOME_GROUPS.includes(groupBy)) throw new SummaryError(\`groupBy: ${INCOME_GROUPS.join(' | ')}, …\`)`,
and the key: add `: groupBy === 'day' ? dateIn(Number(r.time), zoneOf(q))` before the `month` branch. Check that
`dateIn` returns `YYYY-MM-DD` (the month branch slices it to 7); the test pins it.

- [ ] **Step 4: Run, expect PASS** (same command), then the core typecheck:
`pnpm --config.verify-deps-before-run=false --filter @mono/core typecheck` and `--filter @mono/mcp typecheck` (the MCP
server reads `IncomeGroupBy`; it must still only offer `INCOME_GROUP_BY`).

- [ ] **Step 5: Commit** — `feat(core): spendingGrid (category × day / month) and incomeSummary by day for the analytics screen`

---

### Task 2: Contract and pure helpers in main

**Files:**
- Create: `apps/desktop/src/shared/analytics.ts`, `apps/desktop/src/main/analytics.ts`
- Modify: `apps/desktop/src/shared/api.ts`
- Test: `apps/desktop/tests/analytics-main.test.ts`

- [ ] **Step 1: `src/shared/analytics.ts`** (shared by main's IPC check and the renderer's picker)

```ts
// The analytics screen's period rules, shared by main (IPC check) and the renderer (picker): whole months, YYYY-MM.
import { IMPORT_MAX_MONTHS } from './import-range.ts';

/** The longest range: the import floor's months plus the current one. */
export const ANALYTICS_MAX_MONTHS = IMPORT_MAX_MONTHS + 1;

const index = (m: string): number => Number(m.slice(0, 4)) * 12 + Number(m.slice(5, 7)) - 1;

/** `'2026-12'` + 1 → `'2027-01'`. */
export function addMonths(month: string, n: number): string {
  const i = index(month) + n;
  return `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}`;
}

/** Months in [from, to], both included (0 or less when from > to). */
export function monthSpan(from: string, to: string): number {
  return index(to) - index(from) + 1;
}
```

- [ ] **Step 2: Types in `src/shared/api.ts`** (after `IncomeOverview`; `RatesView` and `CategoryId` are already there)

```ts
/** The analytics screen: whole months `YYYY-MM`, from ≤ to, at most ANALYTICS_MAX_MONTHS (src/shared/analytics.ts). One month = from === to. */
export type AnalyticsQuery = { from: string; to: string; participantId?: number };

/** full — data for the whole bucket; running — the current month / today; none — before the first data or after today (values 0, not drawn). */
export type AnalyticsBucketState = 'full' | 'running' | 'none';

export type AnalyticsCategory = {
  category: string;
  categoryId: CategoryId | null;
  /** Hryvnia kopecks per bucket, in `buckets` order. */
  net: number[];
  total: number;
  /** The comparison period's spending; null — no comparison. */
  prev: number | null;
};

/**
 * The analytics screen: income and spending (all scopes, the balances' fold) of a person or the family, hryvnia kopecks by
 * today's rates, per day (one month) or month (a range). Categories, numbers and dates only — no bank text.
 */
export type AnalyticsOverview = {
  from: string;
  to: string;
  unit: 'day' | 'month';
  /** `YYYY-MM-DD` (day) or `YYYY-MM` (month), oldest first. */
  buckets: Array<{ key: string; state: AnalyticsBucketState }>;
  income: number[];
  /** The sum of the categories per bucket. */
  spending: number[];
  totals: { income: number; spending: number; prev: { income: number; spending: number } | null };
  /** Dates; one month — last month (cut to the same day while this one runs); a range — the same number of months before. */
  compare: { from: string; to: string; partial: boolean } | null;
  /** Day only: the usual month's running spending by day — the mean of up to 3 whole months before; null without them. */
  usual: number[] | null;
  /** Spending categories of either period: this period's ranking first (net > 0, net desc), then the others by `prev`. */
  categories: AnalyticsCategory[];
  rates: RatesView | null;
  /** Account currencies left out (no rate today). */
  leftOut: number[];
};
```

And in the API interface, after `getIncomeOverview`: `getAnalyticsOverview(q: AnalyticsQuery): Promise<AnalyticsOverview>;`
(typecheck will fail until Task 4 adds the channel — do Task 4 before the full typecheck, or run only the tests here).

- [ ] **Step 3: Write the failing tests** — `tests/analytics-main.test.ts`

```ts
// Pure helpers of the analytics screen in main. Fictional numbers only.
import { describe, expect, it } from 'vitest';
import { bucketState, daysOf, foldCells, foldIncome, monthsBetween, previousRange, runningTotals, usualCurve } from '../src/main/analytics.ts';
import { addMonths, monthSpan } from '../src/shared/analytics.ts';

const RATES = new Map([[840, { rate: 40, nearest: false }]]);

describe('analytics helpers (main)', () => {
  it('months: add, span, between, the range before', () => {
    expect(addMonths('2026-12', 1)).toBe('2027-01');
    expect(addMonths('2026-01', -1)).toBe('2025-12');
    expect(monthSpan('2025-10', '2026-09')).toBe(12);
    expect(monthsBetween('2025-11', '2026-02')).toEqual(['2025-11', '2025-12', '2026-01', '2026-02']);
    expect(previousRange('2026-01', '2026-03')).toEqual({ from: '2025-10-01', to: '2025-12-31' });
  });

  it('days of a month', () => {
    expect(daysOf('2026-02')).toHaveLength(28);
    expect(daysOf('2026-02')[0]).toBe('2026-02-01');
    expect(daysOf('2024-02').at(-1)).toBe('2024-02-29');
  });

  it('bucket states', () => {
    const at = { today: '2026-03-15', dataFrom: '2026-01-01' };
    expect(bucketState('2026-03-15', 'day', at)).toBe('running');
    expect(bucketState('2026-03-16', 'day', at)).toBe('none');
    expect(bucketState('2026-03-14', 'day', at)).toBe('full');
    expect(bucketState('2025-12-31', 'day', at)).toBe('none');
    expect(bucketState('2026-03', 'month', at)).toBe('running');
    expect(bucketState('2026-02', 'month', at)).toBe('full');
    expect(bucketState('2025-12', 'month', at)).toBe('none');
    expect(bucketState('2026-02', 'month', { today: '2026-03-15', dataFrom: null })).toBe('none');
  });

  it('foldCells: per category per bucket in hryvnia; a currency without a rate is left out', () => {
    const cells = [
      { currency: 980, bucket: '2026-02', category: 'продукты', purchases: 1, gross: 20_000, refunds: 0, net: 20_000 },
      { currency: 840, bucket: '2026-03', category: 'продукты', purchases: 1, gross: 100, refunds: 0, net: 100 },
      { currency: 978, bucket: '2026-03', category: 'кафе', purchases: 1, gross: 50, refunds: 0, net: 50 },
    ];
    const f = foldCells(cells, ['2026-02', '2026-03'], RATES);
    expect([...f.net]).toEqual([['продукты', [20_000, 4_000]]]);
    expect(f.purchases.get('продукты')).toBe(2);
    expect(f.leftOut).toEqual(new Set([978]));
  });

  it('foldIncome: per bucket in hryvnia', () => {
    const groups = [{ currency: 980, key: '2026-03-02', total: 50_000 }, { currency: 840, key: '2026-03-04', total: 100 }, { currency: 978, key: '2026-03-04', total: 9 }];
    const f = foldIncome(groups, ['2026-03-01', '2026-03-02', '2026-03-03', '2026-03-04'], RATES);
    expect(f.values).toEqual([0, 50_000, 0, 4_000]);
    expect(f.leftOut).toEqual(new Set([978]));
  });

  it('running totals and the usual month', () => {
    expect(runningTotals([0, 5, 0, 10])).toEqual([0, 5, 5, 15]);
    // A 3-day month carried at its last value to the 4th day.
    expect(usualCurve([[0, 10, 10, 30], [20, 20, 20]], 4)).toEqual([10, 15, 15, 25]);
    expect(usualCurve([], 4)).toBeNull();
  });
});
```

- [ ] **Step 4: Run, expect FAIL** (module missing): `pnpm --config.verify-deps-before-run=false exec vitest run tests/analytics-main.test.ts`

- [ ] **Step 5: Implement `src/main/analytics.ts`**

```ts
// Pure helpers of the analytics screen in main (DataService.analyticsOverview): the buckets of a period, the period it is
// compared with, folding account currencies into hryvnia by today's rates, the «usual month» curve.
import { toUah, type FxRate } from '@mono/core/fx';
import type { SpendingCell } from '@mono/core/summaries';
import { addMonths, monthSpan } from '../shared/analytics.ts';
import type { AnalyticsBucketState } from '../shared/api.ts';
import { monthBounds } from './spending.ts';

/** The months from..to, both included, oldest first. */
export function monthsBetween(from: string, to: string): string[] {
  return Array.from({ length: monthSpan(from, to) }, (_, i) => addMonths(from, i));
}

/** The same number of whole months right before `from`, as dates. */
export function previousRange(from: string, to: string): { from: string; to: string } {
  const n = monthSpan(from, to);
  return { from: monthBounds(addMonths(from, -n)).from, to: monthBounds(addMonths(from, -1)).to };
}

/** Every date of a month, YYYY-MM-DD. */
export function daysOf(month: string): string[] {
  const last = Number(monthBounds(month).to.slice(8, 10));
  return Array.from({ length: last }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`);
}

/** A day or a month against today and the first date with data (both in the system time zone). */
export function bucketState(key: string, unit: 'day' | 'month', at: { today: string; dataFrom: string | null }): AnalyticsBucketState {
  const now = unit === 'day' ? at.today : at.today.slice(0, 7);
  const first = at.dataFrom === null ? null : unit === 'day' ? at.dataFrom : at.dataFrom.slice(0, 7);
  if (key > now || first === null || key < first) return 'none';
  return key === now ? 'running' : 'full';
}

/** Per category: hryvnia kopecks per bucket in `keys` order, and purchases; a currency without a rate stays out. */
export function foldCells(
  cells: readonly SpendingCell[],
  keys: readonly string[],
  rates: ReadonlyMap<number, FxRate>,
): { net: Map<string, number[]>; purchases: Map<string, number>; leftOut: Set<number> } {
  const at = new Map(keys.map((k, i) => [k, i]));
  const net = new Map<string, number[]>();
  const purchases = new Map<string, number>();
  const leftOut = new Set<number>();
  for (const c of cells) {
    const i = at.get(c.bucket);
    if (i === undefined) continue;
    const uah = toUah(c.net, c.currency, rates);
    if (uah === null) {
      leftOut.add(c.currency);
      continue;
    }
    const row = net.get(c.category) ?? keys.map(() => 0);
    row[i]! += uah;
    net.set(c.category, row);
    purchases.set(c.category, (purchases.get(c.category) ?? 0) + c.purchases);
  }
  return { net, purchases, leftOut };
}

/** Income groups keyed by bucket → hryvnia kopecks per bucket in `keys` order. */
export function foldIncome(
  groups: ReadonlyArray<{ currency: number; key: string; total: number }>,
  keys: readonly string[],
  rates: ReadonlyMap<number, FxRate>,
): { values: number[]; leftOut: Set<number> } {
  const at = new Map(keys.map((k, i) => [k, i]));
  const values = keys.map(() => 0);
  const leftOut = new Set<number>();
  for (const g of groups) {
    const i = at.get(g.key);
    if (i === undefined) continue;
    const uah = toUah(g.total, g.currency, rates);
    if (uah === null) leftOut.add(g.currency);
    else values[i]! += uah;
  }
  return { values, leftOut };
}

export function runningTotals(values: readonly number[]): number[] {
  let sum = 0;
  return values.map((v) => (sum += v));
}

/** The mean of the months' running totals, `days` long; a shorter month is carried at its last value. Null for no months. */
export function usualCurve(months: ReadonlyArray<readonly number[]>, days: number): number[] | null {
  if (months.length === 0) return null;
  return Array.from({ length: days }, (_, d) => {
    const sum = months.reduce((s, m) => s + (m[Math.min(d, m.length - 1)] ?? 0), 0);
    return Math.round(sum / months.length);
  });
}
```

- [ ] **Step 6: Run, expect PASS.** Then commit — `feat(desktop): analytics contract types and main's pure helpers`

---

### Task 3: `DataService.analyticsOverview`

**Files:**
- Modify: `apps/desktop/src/main/data.ts`
- Test: `apps/desktop/tests/data.test.ts`

- [ ] **Step 1: Write the failing tests** (a new `describe` at the end of `data.test.ts`; its `account`, `tx`, `synced`, `svc`, `CANARIES`)

```ts
describe('DataService.analyticsOverview (the analytics screen)', () => {
  const IN = 'поступления';
  beforeEach(async () => {
    await account('uah', 'black', 980, 0);
    await account('usd', 'white', 840, 0);
    for (const id of ['uah', 'usd']) await synced(id);
    await tx('uah', '2026-01-10', -10_000, 'продукты');
    await tx('uah', '2026-02-03', -20_000, 'продукты');
    await tx('uah', '2026-02-05', 50_000, IN, { mcc: 4829 });
    await tx('uah', '2026-02-20', -5_000, 'кафе и рестораны');
    await tx('uah', '2026-03-01', 60_000, IN, { mcc: 4829 });
    await tx('uah', '2026-03-02', -30_000, 'продукты');
    await tx('uah', '2026-03-05', -8_000, 'кафе и рестораны');
    await tx('uah', '2026-03-05', 2_000, 'кафе и рестораны'); // a refund
    await tx('usd', '2026-03-06', -100, 'продукты'); // 1 $ = 40 ₴
    await tx('uah', '2026-03-08', -5_000, 'свои переводы', { rule: 'pair' });
  });

  it('a range: months, states, income and spending per month, ranked categories, no comparison before the data', async () => {
    const v = await svc.analyticsOverview({ from: '2026-01', to: '2026-03' });
    expect(v.unit).toBe('month');
    expect(v.buckets).toEqual([{ key: '2026-01', state: 'full' }, { key: '2026-02', state: 'full' }, { key: '2026-03', state: 'running' }]);
    expect(v.spending).toEqual([10_000, 25_000, 40_000]);
    expect(v.income).toEqual([0, 50_000, 60_000]);
    expect(v.categories.map((c) => [c.categoryId, c.net, c.total, c.prev])).toEqual([
      ['groceries', [10_000, 20_000, 34_000], 64_000, null],
      ['cafes', [0, 5_000, 6_000], 11_000, null],
    ]);
    expect(v.compare).toBeNull();
    expect(v.totals).toEqual({ income: 110_000, spending: 75_000, prev: null });
    expect(v.usual).toBeNull();
  });

  it('one month: days, the month\'s figures equal the balances, last month to the same day, the usual month', async () => {
    const v = await svc.analyticsOverview({ from: '2026-03', to: '2026-03' });
    const month = await svc.monthOverview({ month: '2026-03' });
    expect(v.unit).toBe('day');
    expect(v.buckets).toHaveLength(31);
    expect(v.buckets[14]).toEqual({ key: '2026-03-15', state: 'running' });
    expect(v.buckets[15]!.state).toBe('none');
    expect(v.totals.spending).toBe(month.total.spending);
    expect(v.totals.income).toBe(month.total.income);
    expect(v.spending.slice(0, 6)).toEqual([0, 30_000, 0, 0, 6_000, 4_000]);
    expect(v.compare).toEqual({ from: '2026-02-01', to: '2026-02-10', partial: true });
    expect(v.totals.prev).toEqual({ income: 50_000, spending: 20_000 });
    expect(v.categories.find((c) => c.categoryId === 'cafes')!.prev).toBe(0);
    // January and February are covered; December is not: the mean of two.
    expect(v.usual![2]).toBe(10_000);
    expect(v.usual![9]).toBe(15_000);
    expect(v.usual![30]).toBe(17_500);
  });

  it('a category spent only in the comparison period is listed after the ranked ones, with zeros', async () => {
    await tx('uah', '2026-02-07', -3_000, 'спорт');
    const v = await svc.analyticsOverview({ from: '2026-03', to: '2026-03' });
    expect(v.categories.at(-1)).toMatchObject({ categoryId: 'sport', total: 0, prev: 3_000 });
  });

  it('a person; a currency without a rate is left out; a range ending after this month is refused', async () => {
    rates = { list: [], fetchedAt: NOW, saved: false };
    const v = await svc.analyticsOverview({ from: '2026-03', to: '2026-03', participantId: 1 });
    expect(v.leftOut).toEqual([840]);
    await expect(svc.analyticsOverview({ from: '2026-03', to: '2026-04' })).rejects.toThrow();
  });

  it('carries no bank text', async () => {
    const json = JSON.stringify(await svc.analyticsOverview({ from: '2026-01', to: '2026-03' }));
    for (const c of CANARIES) expect(json).not.toContain(c);
  });
});
```

(The «a person» case assumes the default participant id is 1 — check `listParticipants` in an existing test of this file
and use the id it uses.)

- [ ] **Step 2: Run, expect FAIL**: `pnpm --config.verify-deps-before-run=false exec vitest run tests/data.test.ts`

- [ ] **Step 3: Implement** — imports at the top of `data.ts`:

```ts
import { incomeSummary, spendingGrid, spendingSummary, type IncomeSummary, type SpendingSummary } from '@mono/core/summaries';
import { bucketState, daysOf, foldCells, foldIncome, monthsBetween, previousRange, runningTotals, usualCurve } from './analytics.ts';
import { addMonths } from '../shared/analytics.ts';
```

and `AnalyticsCategory`, `AnalyticsOverview`, `AnalyticsQuery` in the type import. The method, after `incomeOverview`:

```ts
  /**
   * The analytics screen: income and spending of a month (per day) or a range of months (per month), all scopes — the
   * balances' fold — with the period before, per category, and for one month the usual month's running spending.
   */
  async analyticsOverview(q: AnalyticsQuery): Promise<AnalyticsOverview> {
    const db = await this.conn();
    const now = this.d.nowSec();
    const tz = systemTimeZone();
    const today = localDate(now * 1000, tz);
    if (q.to > today.slice(0, 7)) throw new Error('analytics: the range ends after this month');
    const { dataFrom } = await this.status();
    const filters = { tz, ...(q.participantId !== undefined ? { participantId: q.participantId } : {}) };
    const todayRates = await this.d.rates();
    const rates = rateMap(todayRates);

    const unit = q.from === q.to ? 'day' : 'month';
    const period = { from: monthBounds(q.from).from, to: monthBounds(q.to).to };
    const keys = unit === 'day' ? daysOf(q.from) : monthsBetween(q.from, q.to);
    const grid = await spendingGrid(db, { ...period, ...filters, unit }, now);
    const cur = foldCells(grid.cells, keys, rates);
    const inc = foldIncome((await incomeSummary(db, { ...period, ...filters, groupBy: unit }, now)).groups, keys, rates);

    const compare =
      unit === 'day'
        ? comparePeriod(q.from, grid.period, dataFrom)
        : (() => {
            const p = previousRange(q.from, q.to);
            return dataFrom !== null && dataFrom <= p.from ? { ...p, partial: false } : null;
          })();
    let prevBy: Map<string, SpendingAmounts> | null = null;
    let prevTotals: { income: number; spending: number } | null = null;
    if (compare) {
      prevBy = foldByCategory(await spendingSummary(db, { ...compare, ...filters, groupBy: 'category' }, now), rates).byCategory;
      const prevIncome = (await incomeSummary(db, { ...compare, ...filters }, now)).totals.reduce((s, t) => s + (toUah(t.total, t.currency, rates) ?? 0), 0);
      prevTotals = { income: prevIncome, spending: [...prevBy.values()].reduce((s, a) => s + a.net, 0) };
    }

    const sum = (xs: readonly number[]) => xs.reduce((s, x) => s + x, 0);
    const amounts = new Map([...cur.net].map(([k, row]) => [k, { net: sum(row), purchases: cur.purchases.get(k) ?? 0 }]));
    const ranked = rankedCategories(amounts).map(([k]) => k);
    const prevOnly = prevBy ? [...prevBy].filter(([k, a]) => a.net > 0 && !ranked.includes(k)).sort(([, a], [, b]) => b.net - a.net).map(([k]) => k) : [];
    const categories: AnalyticsCategory[] = [...ranked, ...prevOnly].map((category) => {
      const net = cur.net.get(category) ?? keys.map(() => 0);
      return { category, categoryId: CATEGORY_ID.get(category) ?? null, net, total: sum(net), prev: prevBy ? (prevBy.get(category)?.net ?? 0) : null };
    });
    // The spending line is the sum of the listed (positive) categories, as the spending block's total.
    const spending = keys.map((_, i) => categories.reduce((s, c) => s + (c.total > 0 ? c.net[i]! : 0), 0));

    let usual: number[] | null = null;
    if (unit === 'day') {
      const before = [1, 2, 3].map((n) => addMonths(q.from, -n)).filter((m) => dataFrom !== null && dataFrom <= `${m}-01`);
      const curves: number[][] = [];
      for (const m of before) {
        const days = daysOf(m);
        const s = await spendingSummary(db, { ...monthBounds(m), ...filters, groupBy: 'day' }, now);
        const at = new Map(days.map((d, i) => [d, i]));
        const daily = days.map(() => 0);
        for (const g of s.groups) {
          const i = at.get(g.key);
          const u = toUah(g.net, g.currency, rates);
          if (i !== undefined && u !== null) daily[i]! += u;
        }
        curves.push(runningTotals(daily));
      }
      usual = usualCurve(curves, keys.length);
    }

    return {
      from: q.from,
      to: q.to,
      unit,
      buckets: keys.map((key) => ({ key, state: bucketState(key, unit, { today, dataFrom }) })),
      income: inc.values,
      spending,
      totals: { income: sum(inc.values), spending: sum(spending), prev: prevTotals },
      compare,
      usual,
      categories,
      rates: todayRates,
      leftOut: [...new Set([...cur.leftOut, ...inc.leftOut])].sort((a, b) => a - b),
    };
  }
```

Notes for the implementer: `comparePeriod`'s first argument is the month (`q.from`); its result is `{ from, to, partial }`
already. `spendingSummary` groupBy `day` keys are dates of the zone (the «Now» strip relies on it). If
`monthOverview`'s spending is not exactly the categories' sum (e.g. a negative-net category), make the test compare
with what the balances show and adjust the `spending` line to the same rule — the KPIs must equal the balances.

- [ ] **Step 4: Run, expect PASS.** Commit — `feat(desktop): main answers the analytics screen — a month by day or a range by month`

---

### Task 4: IPC method `getAnalyticsOverview`

**Files:**
- Modify: `apps/desktop/src/shared/channels.ts` (after `'getIncomeOverview'`), `src/main/ipc.ts` (`ARG_SCHEMAS`),
  `src/main/index.ts` (handler)
- Test: `apps/desktop/tests/ipc.test.ts`

- [ ] **Step 1: Failing tests** — in the bad-arguments table add:

```ts
    ['getAnalyticsOverview', []],
    ['getAnalyticsOverview', [{ from: '2026-09' }]],
    ['getAnalyticsOverview', [{ from: '2026-9', to: '2026-09' }]],
    ['getAnalyticsOverview', [{ from: '2026-10', to: '2026-09' }]],
    ['getAnalyticsOverview', [{ from: '2023-08', to: '2026-09' }]], // 38 months
    ['getAnalyticsOverview', [{ from: '2026-09', to: '2026-09', participantId: 0 }]],
    ['getAnalyticsOverview', [{ from: '2026-09', to: '2026-09', scope: 'personal' }]],
```

and in the good-arguments test:

```ts
    const an = { from: '2023-09', to: '2026-09', participantId: 2 }; // 37 months: the most
    await expect(ipc.handlers.get('balance:getAnalyticsOverview')!(good, an)).resolves.toEqual({ m: 'getAnalyticsOverview', a: [an] });
```

Also check the test that the locked / db-unavailable lists do not contain it (it is a data channel: closed by default).

- [ ] **Step 2: Run, expect FAIL**: `pnpm --config.verify-deps-before-run=false exec vitest run tests/ipc.test.ts`

- [ ] **Step 3: Implement**

`channels.ts`: `'getAnalyticsOverview',` after `'getIncomeOverview',`.

`ipc.ts` (import `ANALYTICS_MAX_MONTHS`, `monthSpan` from `../shared/analytics.ts`):

```ts
  getAnalyticsOverview: z.tuple([
    z
      .strictObject({ from: month, to: month, participantId: id.optional() })
      .refine((q) => q.from <= q.to && monthSpan(q.from, q.to) <= ANALYTICS_MAX_MONTHS),
  ]),
```

`index.ts`: `getAnalyticsOverview: (q) => data.analyticsOverview(q),` after `getIncomeOverview`.

- [ ] **Step 4: Run the IPC test, then the desktop typecheck** (`pnpm --config.verify-deps-before-run=false --filter @mono/desktop typecheck`). Expect PASS.
- [ ] **Step 5: Commit** — `feat(desktop): IPC getAnalyticsOverview, checked range of whole months`

---

### Task 5: `VMonthRangePicker` (shared/ui)

A popover: «One month | Range» switch, quick picks on the left, a year grid of months (reka-ui `MonthPicker` in «One
month», `MonthRangePicker` in «Range»), a footer with the pick, a slot for the caller's note, «Cancel» / «Show». The
pick is a draft until «Show».

**Files:**
- Create: `shared/ui/components/inputs/VMonthRangePicker.vue`, `shared/ui/styles/components/inputs/vmonthrangepicker.scss`
- Modify: `shared/ui/index.ts` (export it and `type MonthRangePreset`), `shared/ui/README.md` (the components list: ours,
  built on reka-ui), `apps/desktop/tests/ui.test.ts` (own-files list: both new files), i18n `common.monthRangePicker.*`
- Test: `apps/desktop/tests/renderer/month-range-picker.test.ts`

- [ ] **Step 1: i18n** (`uk` shown; `en` / `ru` the same keys)

```json
"monthRangePicker": {
  "label": "Період",
  "one": "Один місяць",
  "range": "Період",
  "quick": "Швидкий вибір",
  "hintOne": "Натисніть на місяць",
  "hintRange": "Натисніть на перший і останній місяць",
  "months": "{n} місяць | {n} місяці | {n} місяців",
  "cancel": "Скасувати",
  "apply": "Показати"
}
```

(under `common`, next to `monthPicker`; `ru`: «Период», «Один месяц», «Период», «Быстрый выбор», «Нажмите на месяц»,
«Нажмите на первый и последний месяц», «{n} месяц | {n} месяца | {n} месяцев», «Отмена», «Показать»; `en`: «Period»,
«One month», «Range», «Quick picks», «Pick a month», «Pick the first and the last month», «{n} month | {n} months» —
match the plural shape `tests/i18n.test.ts` expects for `en`, as in `category.where.more`, «Cancel», «Show».)

- [ ] **Step 2: Failing test** — `tests/renderer/month-range-picker.test.ts`

```ts
// @vitest-environment happy-dom
// VMonthRangePicker: a draft until «Show», one month or a range, quick picks. Texts in Russian (setup-locale).
import { describe, expect, it } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { VMonthRangePicker } from '@/shared/ui';

const PRESETS = {
  month: [{ id: 'last', label: 'Прошлый месяц', from: '2026-09', to: '2026-09' }],
  range: [{ id: '3', label: '3 месяца', from: '2026-07', to: '2026-09' }],
};

async function open(value = { from: '2025-10', to: '2026-09' }) {
  const w = mount(VMonthRangePicker, { props: { modelValue: value, min: '2023-10', max: '2026-10', presets: PRESETS }, attachTo: document.body });
  await w.get('button[aria-haspopup]').trigger('click');
  await flushPromises();
  return w;
}

describe('VMonthRangePicker', () => {
  it('the trigger names the range or the month', () => {
    const a = mount(VMonthRangePicker, { props: { modelValue: { from: '2025-10', to: '2026-09' }, min: '2023-10', max: '2026-10', presets: PRESETS } });
    expect(a.text()).toContain('окт. 2025');
    expect(a.text()).toContain('12 месяцев');
    const b = mount(VMonthRangePicker, { props: { modelValue: { from: '2026-09', to: '2026-09' }, min: '2023-10', max: '2026-10', presets: PRESETS } });
    expect(b.text()).toContain('Сентябрь 2026');
  });

  it('opens on the mode of the value; a quick pick changes only the draft; «Show» emits it', async () => {
    const w = await open();
    const panel = document.body.querySelector('.v-month-range-picker__content')!;
    expect(panel.querySelector('[role="radio"][aria-checked="true"]')!.textContent).toContain('Период');
    (Array.from(panel.querySelectorAll('button')).find((b) => b.textContent?.includes('3 месяца')) as HTMLButtonElement).click();
    await flushPromises();
    expect(w.emitted('update:modelValue')).toBeUndefined();
    (Array.from(panel.querySelectorAll('button')).find((b) => b.textContent === 'Показать') as HTMLButtonElement).click();
    await flushPromises();
    expect(w.emitted('update:modelValue')!.at(-1)).toEqual([{ from: '2026-07', to: '2026-09' }]);
    w.unmount();
  });

  it('«One month» shows its own quick picks and emits from === to', async () => {
    const w = await open();
    const panel = () => document.body.querySelector('.v-month-range-picker__content')!;
    (Array.from(panel().querySelectorAll('[role="radio"]')).find((b) => b.textContent?.includes('Один месяц')) as HTMLButtonElement).click();
    await flushPromises();
    (Array.from(panel().querySelectorAll('button')).find((b) => b.textContent?.includes('Прошлый месяц')) as HTMLButtonElement).click();
    (Array.from(panel().querySelectorAll('button')).find((b) => b.textContent === 'Показать') as HTMLButtonElement).click();
    await flushPromises();
    expect(w.emitted('update:modelValue')!.at(-1)).toEqual([{ from: '2026-09', to: '2026-09' }]);
    w.unmount();
  });

  it('«Cancel» emits nothing', async () => {
    const w = await open();
    (Array.from(document.body.querySelectorAll('.v-month-range-picker__content button')).find((b) => b.textContent === 'Отмена') as HTMLButtonElement).click();
    await flushPromises();
    expect(w.emitted('update:modelValue')).toBeUndefined();
    w.unmount();
  });
});
```

(Adjust the trigger selector and the short-month spelling to what `VMonthPicker`'s tests already use — the trigger is a
reka `PopoverTrigger`, short names come from `monthShortName`.)

- [ ] **Step 3: Run, expect FAIL**: `pnpm --config.verify-deps-before-run=false exec vitest run tests/renderer/month-range-picker.test.ts`

- [ ] **Step 4: Implement `VMonthRangePicker.vue`**

```vue
<!-- Ours, not copied (muzakit has no month range picker). Built on reka-ui MonthPicker / MonthRangePicker in a Popover,
     like VMonthPicker. The value is { from, to } "YYYY-MM" (from === to: one month); a draft until «Show». The caller
     gives the quick picks of each mode and may add a note under the pick (the `note` slot gets the draft). -->
<script setup lang="ts">
import { computed, ref, watch } from "vue";
import {
  MonthPickerCell, MonthPickerCellTrigger, MonthPickerGrid, MonthPickerGridBody, MonthPickerGridRow, MonthPickerHeader,
  MonthPickerHeading, MonthPickerNext, MonthPickerPrev, MonthPickerRoot,
  MonthRangePickerCell, MonthRangePickerCellTrigger, MonthRangePickerGrid, MonthRangePickerGridBody, MonthRangePickerGridRow,
  MonthRangePickerHeader, MonthRangePickerHeading, MonthRangePickerNext, MonthRangePickerPrev, MonthRangePickerRoot,
  PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger,
} from "reka-ui";
import { monthName, monthShortName, t } from "@/shared/lib";
import { calendarToMonth, monthToCalendar } from "./calendarMonth";
import VIcon from "../base/VIcon.vue";
import VSegmentedControl from "./VSegmentedControl.vue";

export interface MonthRangePreset {
  id: string;
  label: string;
  from: string;
  to: string;
}

type Range = { from: string; to: string };
type Mode = "one" | "range";

const { min, max, presets, label = undefined } = defineProps<{
  min: string;
  max: string;
  presets: { month: MonthRangePreset[]; range: MonthRangePreset[] };
  label?: string;
}>();
const value = defineModel<Range>({ required: true });

const open = ref(false);
const mode = ref<Mode>("range");
const draft = ref<Range>({ ...value.value });

watch(open, (o) => {
  if (!o) return;
  draft.value = { ...value.value };
  mode.value = value.value.from === value.value.to ? "one" : "range";
});
watch(mode, (m) => {
  if (m === "one") draft.value = { from: draft.value.to, to: draft.value.to };
});

const span = (r: Range) => (Number(r.to.slice(0, 4)) - Number(r.from.slice(0, 4))) * 12 + Number(r.to.slice(5, 7)) - Number(r.from.slice(5, 7)) + 1;
const shortText = (ym: string) => `${monthShortName(Number(ym.slice(5, 7)))} ${ym.slice(0, 4)}`;
function rangeText(r: Range): string {
  if (r.from === r.to) return `${monthName(Number(r.from.slice(5, 7)))} ${r.from.slice(0, 4)}`;
  return `${shortText(r.from)} – ${shortText(r.to)} · ${t("common.monthRangePicker.months", span(r))}`;
}

const minCalendar = computed(() => monthToCalendar(min));
const maxCalendar = computed(() => monthToCalendar(max));
const one = computed({
  get: () => monthToCalendar(draft.value.from),
  set: (v) => {
    const ym = calendarToMonth(v ?? null);
    if (ym) draft.value = { from: ym, to: ym };
  },
});
const range = computed({
  get: () => ({ start: monthToCalendar(draft.value.from), end: monthToCalendar(draft.value.to) }),
  set: (v) => {
    const from = calendarToMonth(v.start ?? null);
    // The first click alone is already a pick: one month.
    if (from) draft.value = { from, to: calendarToMonth(v.end ?? null) ?? from };
  },
});

const modes = computed(() => [
  { value: "one" as const, label: t("common.monthRangePicker.one") },
  { value: "range" as const, label: t("common.monthRangePicker.range") },
]);
const quick = computed(() => (mode.value === "one" ? presets.month : presets.range));
const isPicked = (p: MonthRangePreset) => p.from === draft.value.from && p.to === draft.value.to;

function pick(p: MonthRangePreset): void {
  draft.value = { from: p.from, to: p.to };
}
function apply(): void {
  value.value = { ...draft.value };
  open.value = false;
}
</script>

<template>
  <PopoverRoot v-model:open="open">
    <PopoverTrigger class="v-month-range-picker__trigger" :aria-label="`${label ?? t('common.monthRangePicker.label')}: ${rangeText(value)}`">
      <VIcon icon="lucide:calendar-range" class="v-month-range-picker__icon" />
      <span>{{ rangeText(value) }}</span>
      <VIcon icon="lucide:chevron-down" class="v-month-range-picker__caret-icon" />
    </PopoverTrigger>
    <PopoverPortal>
      <PopoverContent as-child align="start" :side-offset="6">
        <div class="v-month-range-picker__content">
          <div class="v-month-range-picker__top">
            <VSegmentedControl v-model="mode" :options="modes" size="md" />
            <span class="v-month-range-picker__hint">{{ mode === "one" ? $t("common.monthRangePicker.hintOne") : $t("common.monthRangePicker.hintRange") }}</span>
          </div>
          <div class="v-month-range-picker__body">
            <div class="v-month-range-picker__quick" role="group" :aria-label="$t('common.monthRangePicker.quick')">
              <button
                v-for="p in quick"
                :key="p.id"
                type="button"
                class="v-month-range-picker__preset"
                :class="{ 'v-month-range-picker__preset--on': isPicked(p) }"
                :aria-pressed="isPicked(p)"
                @click="pick(p)"
              >
                {{ p.label }}
              </button>
            </div>
            <MonthPickerRoot
              v-if="mode === 'one'"
              v-slot="{ grid }"
              v-model="one"
              :min-value="minCalendar"
              :max-value="maxCalendar"
              locale="ru-RU"
              :calendar-label="$t('common.monthRangePicker.one')"
              prevent-deselect
              class="v-month-range-picker__calendar"
            >
              <MonthPickerHeader class="v-month-range-picker__header">
                <MonthPickerPrev class="v-month-range-picker__nav" :aria-label="$t('common.monthPicker.prevYear')"><VIcon icon="lucide:chevron-left" /></MonthPickerPrev>
                <MonthPickerHeading class="v-month-range-picker__heading" />
                <MonthPickerNext class="v-month-range-picker__nav" :aria-label="$t('common.monthPicker.nextYear')"><VIcon icon="lucide:chevron-right" /></MonthPickerNext>
              </MonthPickerHeader>
              <MonthPickerGrid class="v-month-range-picker__grid">
                <MonthPickerGridBody>
                  <MonthPickerGridRow v-for="(row, i) in grid.rows" :key="i" class="v-month-range-picker__row">
                    <MonthPickerCell v-for="m in row" :key="m.toString()" :date="m" class="v-month-range-picker__cell-wrap">
                      <MonthPickerCellTrigger :month="m" class="v-month-range-picker__cell">{{ monthShortName(m.month) }}</MonthPickerCellTrigger>
                    </MonthPickerCell>
                  </MonthPickerGridRow>
                </MonthPickerGridBody>
              </MonthPickerGrid>
            </MonthPickerRoot>
            <MonthRangePickerRoot
              v-else
              v-slot="{ grid }"
              v-model="range"
              :min-value="minCalendar"
              :max-value="maxCalendar"
              locale="ru-RU"
              :calendar-label="$t('common.monthRangePicker.range')"
              prevent-deselect
              class="v-month-range-picker__calendar"
            >
              <MonthRangePickerHeader class="v-month-range-picker__header">
                <MonthRangePickerPrev class="v-month-range-picker__nav" :aria-label="$t('common.monthPicker.prevYear')"><VIcon icon="lucide:chevron-left" /></MonthRangePickerPrev>
                <MonthRangePickerHeading class="v-month-range-picker__heading" />
                <MonthRangePickerNext class="v-month-range-picker__nav" :aria-label="$t('common.monthPicker.nextYear')"><VIcon icon="lucide:chevron-right" /></MonthRangePickerNext>
              </MonthRangePickerHeader>
              <MonthRangePickerGrid class="v-month-range-picker__grid">
                <MonthRangePickerGridBody>
                  <MonthRangePickerGridRow v-for="(row, i) in grid.rows" :key="i" class="v-month-range-picker__row">
                    <MonthRangePickerCell v-for="m in row" :key="m.toString()" :date="m" class="v-month-range-picker__cell-wrap">
                      <MonthRangePickerCellTrigger :month="m" class="v-month-range-picker__cell">{{ monthShortName(m.month) }}</MonthRangePickerCellTrigger>
                    </MonthRangePickerCell>
                  </MonthRangePickerGridRow>
                </MonthRangePickerGridBody>
              </MonthRangePickerGrid>
            </MonthRangePickerRoot>
          </div>
          <div class="v-month-range-picker__footer">
            <div class="v-month-range-picker__summary">
              <div class="v-month-range-picker__picked">{{ rangeText(draft) }}</div>
              <slot name="note" :from="draft.from" :to="draft.to" />
            </div>
            <button type="button" class="v-month-range-picker__cancel" @click="open = false">{{ $t("common.monthRangePicker.cancel") }}</button>
            <button type="button" class="v-month-range-picker__apply" @click="apply">{{ $t("common.monthRangePicker.apply") }}</button>
          </div>
        </div>
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>

<style lang="scss" scoped>
@use "../../styles/components/inputs/vmonthrangepicker.scss";
</style>
```

Check before writing: reka's `MonthRangePickerRoot` `modelValue` type (`DateRange` — `{ start?: DateValue; end?: DateValue }`)
and the `locale` the existing `VMonthPicker` passes (copy it, do not hard-code a different one); whether the plural call
is `t(key, n)` in `shared/lib`'s `t` (see an existing plural use, e.g. `category.where.more`). If `MonthRangePicker`
emits only on the second click, keep the first click through its `@update:start-value` (or the `placeholder`) so that a
lone first click is a valid one-month draft — the spec requires it.

- [ ] **Step 5: Styles** — `vmonthrangepicker.scss`: start from `vmonthpicker.scss` (trigger, panel, header, 4-column
row, cells) and add: `__top` (flex, gap, padding, bottom border), `__body` (flex-wrap: the quick list 180–200 px with a
right border, the calendar `flex: 999 1 18rem`), `__preset` (36 px min-height, left-aligned, `--on`: `--ui-primary-subtle`
background, `--ui-primary` text), range cells: `[data-selected]` → `--ui-primary-muted` background,
`[data-selection-start]`, `[data-selection-end]` → `--ui-primary` background with `--ui-primary-foreground` text and
rounded outer corners, `[data-highlighted]` (hover preview) → the same as selected, `[data-disabled]` → muted, no cursor;
`__footer` (flex-wrap, border-top, gap; `__summary` grows), `__apply` primary button, `__cancel` bordered. Tokens only
(`--ui-*`), as the other inputs.

- [ ] **Step 6: Export, README, provenance list**: `shared/ui/index.ts` — `export { default as VMonthRangePicker, type MonthRangePreset } from "./components/inputs/VMonthRangePicker.vue";`;
README — one line in the inputs list; `tests/ui.test.ts` own-files — `VMonthRangePicker.vue`, `vmonthrangepicker.scss`.

- [ ] **Step 7: Run the picker test, `tests/ui.test.ts`, `tests/i18n.test.ts`, the renderer typecheck. Expect PASS.**
- [ ] **Step 8: Commit** — `feat(desktop): VMonthRangePicker — one month or a range of months, quick picks, applied on «Show»`

---

### Task 6: The period of the analytics screen (entity) and the global filters

**Files:**
- Create: `entities/period/store/useRangeStore.ts`, `entities/period/components/{PeriodRangeFilter,RangeNote}.vue`, `entities/period/utils.ts`
- Modify: `entities/period/index.ts`, `app/layouts/types.ts`, `app/router/routes.ts`, `widgets/global-filters/GlobalFilters.vue`, i18n `period.*`
- Test: `tests/renderer/period.test.ts`, `tests/renderer/global-filters.test.ts`

- [ ] **Step 1: i18n** under a new `period` object (uk / en / ru):

```json
"period": {
  "thisMonth": "Цей місяць",
  "lastMonth": "Минулий місяць",
  "yearAgo": "Той самий місяць рік тому",
  "months": "{n} місяць | {n} місяці | {n} місяців",
  "sinceJanuary": "З початку року",
  "lastYear": "{year} рік",
  "all": "Увесь час",
  "compare": "Порівняння з {period}",
  "noCompare": "Для порівняння бракує історії",
  "running": "{month} ще триває — суми неповні"
}
```

- [ ] **Step 2: Failing tests** (append to `tests/renderer/period.test.ts`)

```ts
import { rangePresets, compareText, useRangeStore } from '@/entities/period';

describe('the analytics period', () => {
  beforeEach(() => setActivePinia(createPinia()));

  it('defaults to the last 12 whole months; set() keeps it inside [floor, this month] and from ≤ to', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-06T12:00:00'));
    const s = useRangeStore();
    expect(s.range).toEqual({ from: '2025-10', to: '2026-09' });
    s.set({ from: '2020-01', to: '2027-01' }, '2023-10');
    expect(s.range).toEqual({ from: '2023-10', to: '2026-10' });
    s.set({ from: '2026-05', to: '2026-02' }, '2023-10');
    expect(s.range).toEqual({ from: '2026-02', to: '2026-05' });
    expect(s.single).toBe(false);
    vi.useRealTimers();
  });

  it('quick picks: one month and ranges of whole months ending last month', () => {
    const p = rangePresets('2026-10', '2023-10');
    expect(p.month.map((x) => [x.from, x.to])).toEqual([['2026-10', '2026-10'], ['2026-09', '2026-09'], ['2025-10', '2025-10']]);
    expect(p.range.map((x) => [x.id, x.from, x.to])).toEqual([
      ['3', '2026-07', '2026-09'], ['6', '2026-04', '2026-09'], ['12', '2025-10', '2026-09'], ['24', '2024-10', '2026-09'], ['36', '2023-10', '2026-09'],
      ['ytd', '2026-01', '2026-09'], ['ly', '2025-01', '2025-12'], ['all', '2023-10', '2026-09'],
    ]);
  });

  it('the note: compared with what, and the running month', () => {
    expect(compareText({ from: '2026-09', to: '2026-09' }, '2026-10', '2026-01-01')).toEqual({ compare: 'Сравнение с август 2026', running: null });
    // Write the expected texts from ru.json once the keys exist; the cases: a range → the same months before; no data → noCompare; to = this month → running.
  });
});
```

(Fill the last test with literal Russian expectations from your `ru.json` — e.g. `compareText({ from: '2025-10', to: '2026-10' }, '2026-10', '2024-01-01')`
→ compare «Сравнение с окт. 2024 – сент. 2025», running «Октябрь ещё идёт — суммы неполные».)

In `global-filters.test.ts`: mount the widget under a router whose current route has `meta.periodFilter: 'range'` and
expect the range trigger (`.v-month-range-picker__trigger`) instead of the month one; with no meta — the month one.

- [ ] **Step 3: Run, expect FAIL.**

- [ ] **Step 4: Implement**

`entities/period/store/useRangeStore.ts`:

```ts
import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { shiftMonth, type YearMonth } from '@/shared/lib';
import { useMonthStore } from './useMonthStore.ts';

export type MonthRange = { from: YearMonth; to: YearMonth };

/** The analytics screen's period: whole months, independent of the home screen's month; lives while the app runs. */
export const useRangeStore = defineStore('period-range', () => {
  const months = useMonthStore();
  const last = shiftMonth(months.thisMonth, -1);
  const range = ref<MonthRange>({ from: shiftMonth(last, -11), to: last });
  const single = computed(() => range.value.from === range.value.to);

  /** Ordered, then kept inside [floor, this month]. */
  function set(next: MonthRange, floor: YearMonth): void {
    const [a, b] = next.from <= next.to ? [next.from, next.to] : [next.to, next.from];
    const clamp = (m: YearMonth) => (m > months.thisMonth ? months.thisMonth : m < floor ? floor : m);
    range.value = { from: clamp(a), to: clamp(b) };
  }

  return { range, single, set };
});
```

`entities/period/utils.ts`:

```ts
import type { MonthRangePreset } from '@/shared/ui';
import { monthName, monthShortName, shiftMonth, t, type YearMonth } from '@/shared/lib';

const short = (ym: string) => `${monthShortName(Number(ym.slice(5, 7)))} ${ym.slice(0, 4)}`;
const full = (ym: string) => `${monthName(Number(ym.slice(5, 7)))} ${ym.slice(0, 4)}`;
const span = (from: string, to: string) => (Number(to.slice(0, 4)) - Number(from.slice(0, 4))) * 12 + Number(to.slice(5, 7)) - Number(from.slice(5, 7)) + 1;

/** The picker's quick picks: ranges are whole months ending last month, from the import floor at the earliest. */
export function rangePresets(thisMonth: YearMonth, floor: YearMonth): { month: MonthRangePreset[]; range: MonthRangePreset[] } {
  const last = shiftMonth(thisMonth, -1);
  const atLeast = (m: YearMonth) => (m < floor ? floor : m);
  const year = Number(thisMonth.slice(0, 4));
  return {
    month: [
      { id: 'this', label: t('period.thisMonth'), from: thisMonth, to: thisMonth },
      { id: 'last', label: t('period.lastMonth'), from: last, to: last },
      { id: 'yago', label: t('period.yearAgo'), from: shiftMonth(thisMonth, -12), to: shiftMonth(thisMonth, -12) },
    ],
    range: [
      ...[3, 6, 12, 24, 36].map((n) => ({ id: String(n), label: t('period.months', n), from: atLeast(shiftMonth(last, -(n - 1))), to: last })),
      { id: 'ytd', label: t('period.sinceJanuary'), from: atLeast(`${year}-01` as YearMonth), to: last },
      { id: 'ly', label: t('period.lastYear', { year: year - 1 }), from: atLeast(`${year - 1}-01` as YearMonth), to: `${year - 1}-12` as YearMonth },
      { id: 'all', label: t('period.all'), from: floor, to: last },
    ],
  };
}

/** The picker's note: what the draft is compared with (main's rule, src/main/analytics.ts), and whether it runs into this month. */
export function compareText(r: { from: string; to: string }, thisMonth: string, dataFrom: string | null): { compare: string; running: string | null } {
  const n = span(r.from, r.to);
  const pFrom = shiftMonth(r.from as YearMonth, -n);
  const pTo = shiftMonth(r.from as YearMonth, -1);
  const compare =
    dataFrom === null || dataFrom > `${pFrom}-01` ? t('period.noCompare') : t('period.compare', { period: n === 1 ? full(pFrom).toLowerCase() : `${short(pFrom)} – ${short(pTo)}` });
  return { compare, running: r.to === thisMonth ? t('period.running', { month: monthName(Number(thisMonth.slice(5, 7))) }) : null };
}
```

(`ytd` in January: `from` would be this month after `to` = last month — drop the `ytd` pick when `thisMonth` is January.)

`entities/period/components/PeriodRangeFilter.vue`:

```vue
<script setup lang="ts">
import { computed } from 'vue';
import type { YearMonth } from '@/shared/lib';
import { VMonthRangePicker } from '@/shared/ui';
import { useMonthStore } from '../store/useMonthStore.ts';
import { useRangeStore, type MonthRange } from '../store/useRangeStore.ts';
import { rangePresets } from '../utils.ts';
import RangeNote from './RangeNote.vue';

// dataFrom comes as a prop: an entity does not read another entity (sync-status) — the widget passes it.
const { min, dataFrom } = defineProps<{
  /** The import floor's month. */
  min: YearMonth;
  /** The first date with data, or null. */
  dataFrom: string | null;
}>();
const months = useMonthStore();
const store = useRangeStore();
const range = computed({ get: () => store.range, set: (v) => store.set(v as MonthRange, min) });
const presets = computed(() => rangePresets(months.thisMonth, min));
</script>

<template>
  <VMonthRangePicker v-model="range" :min :max="months.thisMonth" :presets :label="$t('common.monthRangePicker.label')">
    <template #note="{ from, to }">
      <RangeNote :from :to :this-month="months.thisMonth" :data-from />
    </template>
  </VMonthRangePicker>
</template>
```

`entities/period/components/RangeNote.vue` (one `compareText` call per draft):

```vue
<script setup lang="ts">
import { computed } from 'vue';
import { compareText } from '../utils.ts';

const { from, to, thisMonth, dataFrom } = defineProps<{ from: string; to: string; thisMonth: string; dataFrom: string | null }>();
const note = computed(() => compareText({ from, to }, thisMonth, dataFrom));
</script>

<template>
  <div class="text-sm text-foreground-muted">{{ note.compare }}</div>
  <div v-if="note.running" class="text-sm text-warning">{{ note.running }}</div>
</template>
```

`entities/period/index.ts`: export `PeriodRangeFilter`, `useRangeStore`, `type MonthRange`, `rangePresets`, `compareText`.

`app/layouts/types.ts` — in `RouteMeta`:

```ts
    /** Which period the global filters offer: absent — one month (home); `range` — whole months (analytics). */
    periodFilter?: 'range';
```

`routes.ts` — the analytics route's `meta` gains `periodFilter: 'range'`.

`GlobalFilters.vue` — `import { useRoute } from 'vue-router'`, `import { MonthFilter, PeriodRangeFilter, useMonthStore } from '@/entities/period'`;
`const route = useRoute(); const ranged = computed(() => route.meta.periodFilter === 'range');` and in the template:

```vue
          <PeriodRangeFilter v-if="ranged" :min="firstMonth" :data-from="syncStatus.status?.dataFrom ?? null" />
          <MonthFilter v-else :min="firstMonth" />
```

- [ ] **Step 5: Run the two tests, `tests/architecture.test.ts`, `tests/i18n.test.ts`, the renderer typecheck. Expect PASS.**
- [ ] **Step 6: Commit** — `feat(desktop): the analytics period — its own store, quick picks, the range button in the global filters on /analytics`

---

### Task 7: ECharts — lines and the custom fill

**Files:** Modify `shared/ui/components/charts/echarts.ts`; tests `tests/echarts-bundle.test.ts` (unchanged — it must still pass), `tests/renderer/setup-charts.ts` (nothing: it mocks `init`).

- [ ] **Step 1:** register `LineChart` and `CustomChart`:

```ts
import { BarChart, CustomChart, LineChart } from "echarts/charts";
…
use([BarChart, LineChart, CustomChart, GridComponent, TooltipComponent, MarkLineComponent, CanvasRenderer]);
```

and the header comment: «… bars, lines, a custom polygon series (the area between income and spending), …».

- [ ] **Step 2:** `pnpm --config.verify-deps-before-run=false exec vitest run tests/echarts-bundle.test.ts` — expect PASS (no
`new Function`, `eval`, `setAttribute('style')` in the bundle). If it fails, stop and report: the fill then becomes two
stacked line areas instead of a custom series (a design change to agree on).
- [ ] **Step 3: Commit** — `feat(desktop): ECharts registers lines and the custom series`

---

### Task 8: The feature's pure view builders

**Files:**
- Create: `features/analytics-overview/{types.ts,constants.ts,utils.ts}`
- Test: `tests/renderer/analytics.test.ts`
- i18n: `analytics.*` (replace `analytics.placeholder` in Task 10)

- [ ] **Step 1: i18n** (`uk` shown; `ru` / `en` the same keys):

```json
"analytics": {
  "kpi": {
    "income": "Дохід", "spending": "Витрати", "left": "Залишилось", "rate": "Норма заощаджень",
    "vsPrev": "{change} до попереднього періоду", "wasRate": "було {rate}", "perMonth": "у середньому {amount} на місяць", "perDay": "у середньому {amount} на день"
  },
  "flow": {
    "title": "Дохід і витрати", "subtitleMonths": "Зелена заливка — місяць у плюсі, червона — у мінусі", "subtitleDays": "Наростаючим підсумком з 1-го числа",
    "income": "Дохід", "spending": "Витрати", "usual": "Звичайний місяць"
  },
  "changes": { "title": "Що змінилось", "vs": "До {period}", "peak": "пік — {when}", "none": "Без змін, вартих уваги", "all": "Усі категорії в «Порівнянні»" },
  "views": {
    "title": "Категорії", "heat": "Теплова карта", "small": "Міні-графіки", "lines": "Лінії", "compare": "Порівняння",
    "heatHint": "Колір — наскільки відрізняється від звичного для категорії. Суми в тисячах.",
    "smallHint": "У кожної категорії своя шкала. Пунктир — середнє, темний стовпчик — найбільший.",
    "linesHint": "Натисніть на категорію, щоб показати чи сховати її лінію.",
    "compareHint": "Праворуч — витратили більше, ліворуч — менше.",
    "less": "менше звичного", "more": "більше звичного", "avg": "у середньому", "other": "Інші {n}",
    "amount": "Сума", "share": "Частка витрат", "top5": "Топ-5", "allLines": "Усі", "was": "{was} → {now}",
    "fewer": "← менше", "greater": "більше →"
  },
  "leftOut": "Без курсу на сьогодні, не враховано: {currencies}",
  "failed": "Не вдалося завантажити аналітику.",
  "empty": "За цей період даних немає."
}
```

- [ ] **Step 2: Types** — `types.ts`:

```ts
import type { AnalyticsBucketState } from '@contract/api.ts';

export type ViewId = 'heat' | 'small' | 'lines' | 'compare';
export type LinesMode = 'amount' | 'share';

/** One row of the heatmap / small charts / lines: a top category or «Other N». */
export type CategoryRow = { key: string; name: string; color: string; net: number[]; total: number; prev: number | null };

/** A column of the heatmap: one month, or one calendar week clipped to the month. */
export type Column = { label: string; idx: number[]; days: number; state: AnalyticsBucketState };

export type HeatCell = { text: string; title: string; background: string; strong: boolean; running: boolean };
export type HeatRow = { key: string; name: string; color: string; avg: string; cells: HeatCell[] };

export type KpiView = { key: string; label: string; value: string; note: string; tone: 'good' | 'bad' | 'neutral' };
export type ChangeRow = { key: string; name: string; delta: string; pct: string; why: string; up: boolean };
export type CompareRow = { key: string; name: string; left: number; width: number; up: boolean; delta: string; span: string };
export type GapPolygon = { points: Array<[number, number]>; positive: boolean };
```

`constants.ts`:

```ts
import { COLORED } from '@/entities/category';  // if not exported, export it from entities/category/index.ts
/** Rows the views show by name; the rest is one «Other N» row. */
export const TOP_ROWS = COLORED;
/** Lines on by default. */
export const DEFAULT_LINES = 5;
/** Within ±12% of the row's usual level a heatmap cell is neutral. */
export const HEAT_EVEN = 0.12;
export const VIEW_IDS = ['heat', 'small', 'lines', 'compare'] as const;
```

- [ ] **Step 3: Failing tests** — `tests/renderer/analytics.test.ts` (fixture: a fictional 12-month range and a fictional
September by day):

```ts
// @vitest-environment happy-dom
// The analytics screen (features/analytics-overview): pure view builders, then the screen mounted. Fictional fixtures only.
import { describe, expect, it } from 'vitest';
import type { AnalyticsOverview } from '@contract/api.ts';
import { moneyFormat } from '@/entities/currency-display';
import { categoryRows, changesView, columns, compareRows, gapPolygons, heatRows, kpiView, weekGroups } from '@/features/analytics-overview/utils.ts';

const FMT = moneyFormat(null, { main: 980, also: { uah: false, usd: false, eur: false } });
const MONTHS = ['2025-10', '2025-11', '2025-12', '2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09'];
const cat = (categoryId: string, net: number[], prev: number | null) => ({ category: categoryId, categoryId: categoryId as never, net, total: net.reduce((s, x) => s + x, 0), prev });
const k = (xs: number[]) => xs.map((x) => x * 100_000); // thousands of hryvnias → kopecks
const RANGE: AnalyticsOverview = {
  from: '2025-10', to: '2026-09', unit: 'month',
  buckets: MONTHS.map((key) => ({ key, state: 'full' as const })),
  income: k([82, 84, 118, 80, 82, 85, 86, 88, 90, 92, 90, 95]),
  spending: k([64, 70, 104, 61, 64, 70, 69, 75, 93, 89, 75, 71]),
  totals: { income: k([1072])[0]!, spending: k([905])[0]!, prev: { income: k([980])[0]!, spending: k([823])[0]! } },
  compare: { from: '2024-10-01', to: '2025-09-30', partial: false },
  usual: null,
  categories: [
    cat('groceries', k([16, 17, 22, 16, 16, 17, 17, 18, 18, 18, 18, 18]), k([188])[0]!),
    cat('cafes', k([8, 9, 13, 7, 8, 9, 10, 11, 12, 13, 11, 10]), k([96])[0]!),
    cat('home', k([6, 9, 14, 4, 5, 7, 5, 8, 4, 5, 6, 7]), k([92])[0]!),
    cat('marketplaces', k([5, 6, 12, 4, 5, 5, 6, 6, 5, 6, 7, 6]), k([58])[0]!),
    cat('transport', k([5, 5, 6, 5, 5, 5, 6, 6, 6, 7, 6, 6]), k([71])[0]!),
    cat('utilities', k([6, 6, 7, 8, 8, 7, 6, 4, 3, 3, 3, 4]), k([70])[0]!),
    cat('travel', k([0, 0, 8, 0, 0, 2, 0, 3, 26, 18, 4, 0]), k([34])[0]!),
    cat('health', k([4, 3, 4, 6, 5, 4, 4, 3, 3, 3, 4, 5]), k([60])[0]!),
    cat('pets', k([14, 15, 18, 11, 12, 14, 15, 16, 16, 16, 16, 15]), k([154])[0]!),
  ],
  rates: null,
  leftOut: [],
};

describe('analytics view builders', () => {
  it('rows: the top 7 by name and colour, the rest as «Other N»', () => {
    const rows = categoryRows(RANGE.categories, 12);
    expect(rows).toHaveLength(8);
    expect(rows[0]).toMatchObject({ key: 'groceries', name: 'Продукты', color: 'var(--category-1)' });
    expect(rows.at(-1)).toMatchObject({ key: 'other', name: 'Другие 2', color: 'var(--category-other)' });
    expect(rows.at(-1)!.net[0]).toBe(k([18])[0]);
  });

  it('weeks of a month: Monday to Sunday, clipped', () => {
    const days = Array.from({ length: 30 }, (_, i) => `2026-09-${String(i + 1).padStart(2, '0')}`); // 1 Sep 2026 is a Tuesday
    expect(weekGroups(days).map((w) => [w.label, w.idx.length])).toEqual([['1–6', 6], ['7–13', 7], ['14–20', 7], ['21–27', 7], ['28–30', 3]]);
  });

  it('heatmap: colour by the per-day level against the row mean; a running column is outlined and out of the mean', () => {
    const view = { ...RANGE, buckets: RANGE.buckets.map((b, i) => (i === 11 ? { ...b, state: 'running' as const } : b)) };
    const rows = heatRows(categoryRows(view.categories, 12), columns(view), FMT);
    const travel = rows.find((r) => r.key === 'travel')!;
    expect(travel.cells[8]!.background).toContain('--heat-hot');
    expect(travel.cells[0]!.background).toContain('--heat-cold');
    expect(travel.cells[11]!.running).toBe(true);
    expect(rows[0]!.cells[4]!.background).toBe('var(--surface-sunken)'); // groceries in February: within ±12%
  });

  it('KPIs: income, spending, left and savings rate with the changes', () => {
    const v = kpiView(RANGE, FMT);
    expect(v.map((x) => x.key)).toEqual(['income', 'spending', 'left', 'rate']);
    expect(v[2]!.value).toBe(FMT.money(k([167])[0]!));
    expect(v[3]!.value).toBe('15,6%');
    expect(v[3]!.note).toBe('было 16,0%');
    expect(v[1]!.tone).toBe('bad');
  });

  it('what changed: 4 largest increases, then the largest decrease; where the peak was', () => {
    const v = changesView(RANGE, FMT);
    expect(v.map((r) => r.key)).toEqual(['travel', 'cafes', 'groceries', 'marketplaces', 'home']);
    expect(v[0]).toMatchObject({ up: true, pct: '+79%', why: 'пик — июнь' });
    expect(v[4]!.up).toBe(false);
  });

  it('compare: every category, sorted by change, bars from the centre', () => {
    const v = compareRows(RANGE, FMT);
    expect(v[0]!.key).toBe('travel');
    expect(v.at(-1)!.key).toBe('health');
    expect(v.at(-1)!.left + v.at(-1)!.width).toBe(50);
  });

  it('gap polygons: a crossing splits the area exactly', () => {
    const p = gapPolygons([10, 10], [5, 15]);
    expect(p).toEqual([
      { positive: true, points: [[0, 10], [0.5, 10], [0, 5]] },
      { positive: false, points: [[0.5, 10], [1, 10], [1, 15]] },
    ]);
  });
});
```

(Russian texts follow `setup-locale.ts`; write them from your `ru.json`. Peak months use the genitive-free name
`monthName(n).toLowerCase()`.)

- [ ] **Step 4: Run, expect FAIL**: `pnpm --config.verify-deps-before-run=false exec vitest run tests/renderer/analytics.test.ts`

- [ ] **Step 5: Implement `utils.ts`**

```ts
import type { AnalyticsCategory, AnalyticsOverview } from '@contract/api.ts';
import { categoryColor, categoryName } from '@/entities/category';
import type { MoneyFormat } from '@/entities/currency-display';
import { change, monthName, monthShortName, t } from '@/shared/lib';
import { HEAT_EVEN, TOP_ROWS } from './constants.ts';
import type { CategoryRow, ChangeRow, Column, CompareRow, GapPolygon, HeatRow, KpiView } from './types.ts';

const sum = (xs: readonly number[]) => xs.reduce((s, x) => s + x, 0);
const signed = (fmt: MoneyFormat, v: number) => (v >= 0 ? '+' : '−') + fmt.money(Math.abs(v));
const pctText = (now: number, was: number) => (was > 0 ? `${now >= was ? '+' : '−'}${Math.abs(Math.round(((now - was) / was) * 100))}%` : '');
const percent = (x: number) => `${(Math.round(x * 1000) / 10).toLocaleString('ru-RU', { minimumFractionDigits: 1 })}%`;

/** The top categories by the period's ranking (one colour per category on every view) and «Other N» for the rest. */
export function categoryRows(cats: readonly AnalyticsCategory[], buckets: number): CategoryRow[] {
  const spent = cats.filter((c) => c.total > 0);
  const top = spent.slice(0, TOP_ROWS).map((c, i) => ({ key: c.categoryId ?? c.category, name: categoryName(c), color: categoryColor(i), net: c.net, total: c.total, prev: c.prev }));
  const rest = spent.slice(TOP_ROWS);
  if (rest.length === 0) return top;
  const net = Array.from({ length: buckets }, (_, i) => sum(rest.map((c) => c.net[i]!)));
  const prev = rest.every((c) => c.prev === null) ? null : sum(rest.map((c) => c.prev ?? 0));
  return [...top, { key: 'other', name: t('analytics.views.other', { n: rest.length }), color: categoryColor(null), net, total: sum(net), prev }];
}

/** Calendar weeks Monday to Sunday of the given consecutive dates, labelled by their first and last day numbers. */
export function weekGroups(days: readonly string[]): Array<{ label: string; idx: number[] }> {
  const out: Array<{ label: string; idx: number[] }> = [];
  days.forEach((d, i) => {
    const monday = new Date(`${d}T00:00:00Z`).getUTCDay() === 1;
    if (i === 0 || monday) out.push({ label: '', idx: [] });
    out.at(-1)!.idx.push(i);
  });
  for (const w of out) {
    const a = Number(days[w.idx[0]!]!.slice(8, 10));
    const b = Number(days[w.idx.at(-1)!]!.slice(8, 10));
    w.label = a === b ? String(a) : `${a}–${b}`;
  }
  return out;
}

const daysInMonth = (ym: string) => new Date(Date.UTC(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)), 0)).getUTCDate();

/** The heatmap's columns: months of a range; weeks of one month. A column runs or is empty as its buckets do. */
export function columns(v: AnalyticsOverview): Column[] {
  if (v.unit === 'month') {
    return v.buckets.map((b, i) => ({ label: bucketLabel(b.key, 'month', i), idx: [i], days: daysInMonth(b.key), state: b.state }));
  }
  return weekGroups(v.buckets.map((b) => b.key)).map((w) => {
    const states = w.idx.map((i) => v.buckets[i]!.state);
    const shown = w.idx.filter((i) => v.buckets[i]!.state !== 'none');
    return {
      label: w.label,
      idx: w.idx,
      days: shown.length,
      state: shown.length === 0 ? 'none' : states.includes('running') || shown.length < w.idx.length ? 'running' : 'full',
    };
  });
}

/** A month: its short name (with the year on January and on the first column); a day: its number. */
export function bucketLabel(key: string, unit: 'day' | 'month', i: number): string {
  if (unit === 'day') return String(Number(key.slice(8, 10)));
  const m = Number(key.slice(5, 7));
  return m === 1 || i === 0 ? `${monthShortName(m)} ’${key.slice(2, 4)}` : monthShortName(m);
}

/** Cells against the row's usual level: its mean per day over full columns. ±HEAT_EVEN is neutral. */
export function heatRows(rows: readonly CategoryRow[], cols: readonly Column[], fmt: MoneyFormat): HeatRow[] {
  return rows.map((r) => {
    // In the screen's currency: the cells read in thousands of it.
    const values = cols.map((c) => fmt.convert(sum(c.idx.map((i) => r.net[i]!))));
    const full = cols.map((c, j) => ({ c, v: values[j]! })).filter(({ c }) => c.state === 'full' && c.days > 0);
    const perDay = full.length ? sum(full.map((x) => x.v)) / sum(full.map((x) => x.c.days)) : 0;
    const perCol = full.length ? sum(full.map((x) => x.v)) / full.length : 0;
    return {
      key: r.key,
      name: r.name,
      color: r.color,
      avg: thousands(perCol),
      cells: cols.map((c, j) => {
        const v = values[j]!;
        const ratio = perDay > 0 && c.days > 0 ? v / c.days / perDay : 1;
        const background =
          c.state === 'none' ? 'transparent'
          : ratio > 1 + HEAT_EVEN ? `color-mix(in oklch, var(--heat-hot) ${Math.round(Math.min(70, 18 + (ratio - 1) * 55))}%, var(--surface))`
          : ratio < 1 - HEAT_EVEN ? `color-mix(in oklch, var(--heat-cold) ${Math.round(Math.min(60, 15 + (1 - ratio) * 60))}%, var(--surface))`
          : 'var(--surface-sunken)';
        return { text: c.state === 'none' ? '' : v === 0 ? '—' : thousands(v), title: `${r.name}, ${c.label}`, background, strong: ratio > 1.4, running: c.state === 'running' };
      }),
    };
  });
}

/** Kopecks → thousands of hryvnias with one decimal under 10 («4,5», «18»). */
function thousands(kopecks: number): string {
  const v = kopecks / 100_000;
  return v < 10 ? (Math.round(v * 10) / 10).toLocaleString('ru-RU') : String(Math.round(v));
}
```

`--heat-hot` / `--heat-cold`: add them to `app/styles/theme.css` next to `--category-*` (light: `oklch(66% .16 50)` /
`oklch(62% .13 240)`; dark: `oklch(70% .15 50)` / `oklch(66% .12 240)`). `thousands` divides minor units by 100 000
— the same for every main currency (₴, $, €).

KPIs, changes, compare, gap:

```ts
export function kpiView(v: AnalyticsOverview, fmt: MoneyFormat): KpiView[] {
  const { income, spending, prev } = v.totals;
  const left = income - spending;
  const rate = income > 0 ? left / income : null;
  const prevRate = prev && prev.income > 0 ? (prev.income - prev.spending) / prev.income : null;
  const vs = (now: number, was: number | undefined) => (was === undefined || was <= 0 ? '' : t('analytics.kpi.vsPrev', { change: pctText(now, was) }));
  const shown = v.buckets.filter((b) => b.state !== 'none').length || 1;
  return [
    { key: 'income', label: t('analytics.kpi.income'), value: fmt.money(income), note: vs(income, prev?.income), tone: prev && income >= prev.income ? 'good' : 'neutral' },
    { key: 'spending', label: t('analytics.kpi.spending'), value: fmt.money(spending), note: vs(spending, prev?.spending), tone: prev && spending > prev.spending ? 'bad' : 'neutral' },
    { key: 'left', label: t('analytics.kpi.left'), value: fmt.money(left), note: t(v.unit === 'day' ? 'analytics.kpi.perDay' : 'analytics.kpi.perMonth', { amount: fmt.money(Math.round(left / shown)) }), tone: left >= 0 ? 'neutral' : 'bad' },
    { key: 'rate', label: t('analytics.kpi.rate'), value: rate === null ? '—' : percent(rate), note: prevRate === null ? '' : t('analytics.kpi.wasRate', { rate: percent(prevRate) }), tone: rate !== null && prevRate !== null && rate < prevRate ? 'bad' : 'neutral' },
  ];
}

const deltaOf = (c: AnalyticsCategory) => c.total - (c.prev ?? 0);

/** 4 largest increases, then the largest decrease (else the 5th increase); the peak bucket says where it happened. */
export function changesView(v: AnalyticsOverview, fmt: MoneyFormat): ChangeRow[] {
  if (!v.compare) return [];
  const moved = v.categories.filter((c) => deltaOf(c) !== 0);
  const up = moved.filter((c) => deltaOf(c) > 0).sort((a, b) => deltaOf(b) - deltaOf(a));
  const down = moved.filter((c) => deltaOf(c) < 0).sort((a, b) => deltaOf(a) - deltaOf(b));
  const picked = down.length ? [...up.slice(0, 4), down[0]!] : up.slice(0, 5);
  return picked.map((c) => {
    const peak = c.net.indexOf(Math.max(...c.net));
    const key = v.buckets[peak]!.key;
    const when = v.unit === 'month' ? monthName(Number(key.slice(5, 7))).toLowerCase() : `${Number(key.slice(8, 10))} ${monthShortName(Number(key.slice(5, 7)))}`;
    return { key: c.categoryId ?? c.category, name: categoryName(c), delta: signed(fmt, deltaOf(c)), pct: pctText(c.total, c.prev ?? 0), why: c.total > 0 ? t('analytics.changes.peak', { when }) : '', up: deltaOf(c) > 0 };
  });
}

export function compareRows(v: AnalyticsOverview, fmt: MoneyFormat): CompareRow[] {
  if (!v.compare) return [];
  const rows = [...v.categories].sort((a, b) => deltaOf(b) - deltaOf(a));
  const max = Math.max(1, ...rows.map((c) => Math.abs(deltaOf(c))));
  return rows.map((c) => {
    const d = deltaOf(c);
    const w = (Math.abs(d) / max) * 50;
    return {
      key: c.categoryId ?? c.category, name: categoryName(c), up: d >= 0, left: d >= 0 ? 50 : 50 - w, width: w,
      delta: `${signed(fmt, d)} · ${pctText(c.total, c.prev ?? 0)}`.replace(/ · $/, ''),
      span: t('analytics.views.was', { was: fmt.money(c.prev ?? 0), now: fmt.money(c.total) }),
    };
  });
}

/** The area between two lines over x = 0…n−1 as polygons, split exactly where they cross; positive — `a` above `b`. */
export function gapPolygons(a: readonly (number | null)[], b: readonly (number | null)[]): GapPolygon[] {
  const out: GapPolygon[] = [];
  for (let i = 0; i < a.length - 1; i++) {
    const a0 = a[i], a1 = a[i + 1], b0 = b[i], b1 = b[i + 1];
    if (a0 == null || a1 == null || b0 == null || b1 == null) continue;
    const d0 = a0 - b0, d1 = a1 - b1;
    if (d0 >= 0 === d1 >= 0) {
      out.push({ positive: d0 + d1 >= 0, points: [[i, a0], [i + 1, a1], [i + 1, b1], [i, b0]] });
    } else {
      const x = i + d0 / (d0 - d1);
      const y = a0 + (x - i) * (a1 - a0);
      out.push({ positive: d0 >= 0, points: [[i, a0], [x, y], [i, b0]] });
      out.push({ positive: d1 >= 0, points: [[x, y], [i + 1, a1], [i + 1, b1]] });
    }
  }
  return out;
}
```

(If the test's expected polygon for equal segments needs 4 points, the test above already uses a crossing; add one case
without crossing: `gapPolygons([10, 20], [5, 5])` → one positive 4-point polygon.)

- [ ] **Step 6: Run, expect PASS.** Commit — `feat(desktop): analytics view builders — rows, weeks, heatmap, KPIs, what changed, compare, the gap`

---

### Task 9: Chart options

**Files:** Modify `features/analytics-overview/utils.ts`; test `tests/renderer/analytics.test.ts`

- [ ] **Step 1: Failing tests** (append):

```ts
import { flowChartOption, linesOption, miniOption } from '@/features/analytics-overview/utils.ts';

describe('analytics chart options', () => {
  it('flow (a range): income and spending lines on a value axis by index, two fill series, months as labels', () => {
    const o = flowChartOption(RANGE, FMT) as any;
    expect(o.xAxis.type).toBe('value');
    expect(o.series.map((s: any) => s.type)).toEqual(['custom', 'custom', 'line', 'line']);
    expect(o.series[2].data[0]).toEqual([0, RANGE.income[0]]);
    expect(o.xAxis.axisLabel.formatter(0)).toBe('окт. ’25');
  });

  it('flow (a month): running totals, the usual month dashed, days after today not drawn', () => {
    const days = Array.from({ length: 30 }, (_, i) => `2026-09-${String(i + 1).padStart(2, '0')}`);
    const month: AnalyticsOverview = {
      ...RANGE, from: '2026-09', to: '2026-09', unit: 'day',
      buckets: days.map((key, i) => ({ key, state: i < 20 ? 'full' : i === 20 ? 'running' : 'none' })),
      income: days.map((_, i) => (i === 4 ? 9_000_000 : 0)),
      spending: days.map(() => 100_000),
      usual: days.map((_, i) => (i + 1) * 90_000),
    };
    const o = flowChartOption(month, FMT) as any;
    const spending = o.series.find((s: any) => s.id === 'spending');
    expect(spending.data[1]).toEqual([1, 200_000]);
    expect(spending.data[21]).toEqual([21, null]);
    expect(o.series.find((s: any) => s.id === 'usual').lineStyle.type).toBe('dashed');
  });

  it('lines: one series per row that is on; hovering fades the others; share mode in percent', () => {
    const rows = categoryRows(RANGE.categories, 12);
    const o = linesOption(RANGE, rows, new Set(['groceries', 'cafes']), 'cafes', 'share', FMT) as any;
    expect(o.series.map((s: any) => s.id)).toEqual(['groceries', 'cafes']);
    expect(o.series[0].lineStyle.opacity).toBeLessThan(0.5);
    expect(o.series[1].data[0][1]).toBeCloseTo((8 / 64) * 100);
  });

  it('a small chart: bars, the peak solid, the dashed mean', () => {
    const row = categoryRows(RANGE.categories, 12).find((r) => r.key === 'travel')!;
    const o = miniOption(RANGE, row) as any;
    expect(o.series[0].data[8].itemStyle.opacity).toBe(1);
    expect(o.series[0].markLine.data[0].yAxis).toBe(row.total / 12);
  });
});
```

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Implement** (in `utils.ts`; `ChartOption` from `@/shared/ui`, `besidePointer`, `SOFT_BAR` from `@/entities/operations`
only if that keeps the architecture test green — a feature may import entities):

```ts
import type { ChartOption } from '@/shared/ui';
import { besidePointer } from '@/entities/operations';

const xAxisOf = (v: AnalyticsOverview) => ({
  type: 'value',
  min: 0,
  max: v.buckets.length - 1,
  interval: 1,
  splitLine: { show: false },
  axisLine: { lineStyle: { color: 'var(--border)' } },
  axisTick: { show: false },
  axisLabel: {
    color: 'var(--foreground-muted)',
    fontSize: 11,
    // Days: the 1st and every 5th; months: all.
    formatter: (x: number) => {
      const b = v.buckets[x];
      if (!b) return '';
      if (v.unit === 'day' && x !== 0 && (x + 1) % 5 !== 0) return '';
      return bucketLabel(b.key, v.unit, x);
    },
  },
});
const yAxisOf = (fmt: MoneyFormat) => ({
  type: 'value',
  splitLine: { lineStyle: { color: 'var(--border-subtle)' } },
  axisLabel: { color: 'var(--foreground-muted)', fontSize: 11, formatter: (y: number) => fmt.money(y) },
});

/** Drawn values: null where the bucket has no data; a month's days are running totals. */
function drawn(v: AnalyticsOverview, values: readonly number[], running: boolean): Array<number | null> {
  let s = 0;
  return values.map((x, i) => {
    s += x;
    return v.buckets[i]!.state === 'none' ? null : running ? s : x;
  });
}

function fill(id: string, polys: GapPolygon[], color: string) {
  return {
    id, type: 'custom', silent: true, z: 1,
    itemStyle: { color },
    data: polys.map((_, i) => [i]),
    renderItem: (params: { dataIndex: number }, api: { coord: (p: [number, number]) => [number, number]; visual: (k: string) => string }) => ({
      type: 'polygon',
      shape: { points: polys[params.dataIndex]!.points.map((p) => api.coord(p)) },
      style: { fill: api.visual('color'), opacity: 0.16 },
    }),
  };
}

export function flowChartOption(v: AnalyticsOverview, fmt: MoneyFormat): ChartOption {
  const days = v.unit === 'day';
  const income = drawn(v, v.income, days);
  const spending = drawn(v, v.spending, days);
  const polys = gapPolygons(income, spending);
  const line = (id: string, name: string, color: string, values: Array<number | null>, dashed = false) => ({
    id, name, type: 'line', z: 3, showSymbol: !days, symbolSize: 6, connectNulls: false,
    lineStyle: { color, width: dashed ? 1.5 : 2.5, type: dashed ? 'dashed' : 'solid' },
    itemStyle: { color },
    data: values.map((y, x) => [x, y]),
  });
  return {
    grid: { left: 8, right: 16, top: 16, bottom: 8, containLabel: true },
    xAxis: xAxisOf(v),
    yAxis: yAxisOf(fmt),
    tooltip: {
      trigger: 'axis', renderMode: 'richText', position: besidePointer,
      formatter: (ps: Array<{ seriesName: string; value: [number, number | null] }>) => {
        const x = ps[0]?.value[0] ?? 0;
        const head = v.unit === 'day' ? v.buckets[x]!.key : bucketLabel(v.buckets[x]!.key, 'month', 0);
        return [head, ...ps.filter((p) => p.seriesName && p.value[1] !== null).map((p) => `${p.seriesName}: ${fmt.money(p.value[1]!)}`)].join('\n');
      },
    },
    series: [
      fill('gain', polys.filter((p) => p.positive), 'var(--success)'),
      fill('loss', polys.filter((p) => !p.positive), 'var(--danger)'),
      line('income', t('analytics.flow.income'), 'var(--success)', income),
      line('spending', t('analytics.flow.spending'), 'var(--primary)', spending),
      ...(days && v.usual ? [line('usual', t('analytics.flow.usual'), 'var(--foreground-muted)', v.usual.map((y) => y), true)] : []),
    ],
  };
}

export function linesOption(
  v: AnalyticsOverview,
  rows: readonly CategoryRow[],
  on: ReadonlySet<string>,
  hover: string | null,
  mode: 'amount' | 'share',
  fmt: MoneyFormat,
): ChartOption {
  const days = v.unit === 'day';
  const total = drawn(v, v.spending, days);
  const y = yAxisOf(fmt);
  return {
    grid: { left: 8, right: 16, top: 16, bottom: 8, containLabel: true },
    xAxis: xAxisOf(v),
    yAxis: mode === 'share' ? { ...y, axisLabel: { ...y.axisLabel, formatter: (n: number) => `${n}%` } } : y,
    tooltip: { trigger: 'axis', renderMode: 'richText', position: besidePointer },
    series: rows.filter((r) => on.has(r.key)).map((r) => {
      const values = drawn(v, r.net, days);
      const faded = hover !== null && hover !== r.key;
      return {
        id: r.key, name: r.name, type: 'line', showSymbol: false, emphasis: { focus: 'series' },
        lineStyle: { color: r.color, width: hover === r.key ? 3.5 : 2.25, opacity: faded ? 0.15 : 1 },
        itemStyle: { color: r.color },
        data: values.map((y, x) => [x, y === null ? null : mode === 'share' ? (total[x] ? (y / total[x]!) * 100 : 0) : y]),
      };
    }),
  };
}
```

```ts
export function miniOption(v: AnalyticsOverview, row: CategoryRow): ChartOption {
  const shown = v.buckets.map((b) => b.state !== 'none');
  const peak = row.net.indexOf(Math.max(...row.net));
  const n = shown.filter(Boolean).length || 1;
  return {
    grid: { left: 0, right: 0, top: 4, bottom: 0 },
    xAxis: { type: 'category', show: false, data: v.buckets.map((b) => b.key) },
    yAxis: { type: 'value', show: false },
    series: [{
      type: 'bar', barWidth: '60%', silent: true,
      data: row.net.map((y, i) => ({ value: shown[i] ? y : null, itemStyle: { color: row.color, opacity: i === peak ? 1 : 0.45, borderRadius: [2, 2, 0, 0] } })),
      markLine: { silent: true, symbol: 'none', label: { show: false }, lineStyle: { color: 'var(--foreground-secondary)', type: 'dashed', width: 1 }, data: [{ yAxis: row.total / n }] },
    }],
  };
}
```

(The test's mean uses 12 buckets — all `full` in the fixture, so `row.total / 12` holds.)

- [ ] **Step 4: Run, expect PASS.** Commit — `feat(desktop): analytics chart options — income and spending with the gap, category lines, small bars`

---

### Task 10: The screen

**Files:**
- Create: `features/analytics-overview/api/useAnalyticsRequest.ts`, `composables/useAnalytics.ts`,
  `components/{AnalyticsKpis,FlowChart,ChangesList,CategoryViews,HeatmapView,SmallChartsView,LinesView,CompareView}.vue`,
  `AnalyticsFeature.vue`, `index.ts`
- Modify: `pages/analytics/AnalyticsPage.vue`, `pages/analytics/index.ts` (if it re-exports), i18n (remove `analytics.placeholder.*`)
- Test: `tests/renderer/analytics.test.ts`, `tests/pages.test.ts` (one root element — still holds)

- [ ] **Step 1: Failing screen tests** (append; mounts the feature with a stubbed `balanceApi.getAnalyticsOverview`, like
`income-detail.test.ts` stubs `getIncomeOverview` — copy its `vi.mock('@/shared/api', …)` and router/pinia setup):

```ts
describe('the analytics screen', () => {
  it('asks for the store\'s range and person; shows KPIs, the chart, what changed and the heatmap by default', async () => {
    const calls: unknown[] = [];
    getAnalyticsOverview.mockImplementation(async (q: unknown) => (calls.push(q), RANGE));
    const w = await mountFeature();
    expect(calls).toEqual([{ from: '2025-10', to: '2026-09' }]);
    expect(w.findAll('[data-test="kpi"]')).toHaveLength(4);
    expect(w.text()).toContain('Что изменилось');
    expect(w.find('[role="table"]').exists()).toBe(true);
    expect(chartCalls.length).toBeGreaterThan(0);
  });

  it('the segmented control switches the views; a «What changed» row opens «Lines» with that category alone', async () => {
    const w = await mountFeature();
    await w.findAll('[role="radio"]').find((b) => b.text().includes('Мини-графики'))!.trigger('click');
    expect(w.findAll('[data-test="mini"]')).toHaveLength(8);
    await w.findAll('[data-test="change"]')[0]!.trigger('click');
    expect(w.find('[role="radio"][aria-checked="true"]').text()).toContain('Линии');
    expect(w.findAll('[data-test="line-chip"][aria-pressed="true"]').map((c) => c.text())).toEqual([expect.stringContaining('Путешествия')]);
  });

  it('one month: the flow subtitle says running totals; the heatmap columns are weeks', async () => {
    getAnalyticsOverview.mockResolvedValue(MONTH_VIEW); // the September-by-day fixture from Task 9, as a const
    const w = await mountFeature();
    expect(w.text()).toContain('нарастающим итогом');
    expect(w.findAll('[role="columnheader"]').map((c) => c.text())).toContain('1–6');
  });

  it('a failure and an empty period have their texts', async () => {
    getAnalyticsOverview.mockRejectedValue(new Error('x'));
    expect((await mountFeature()).text()).toContain('Не удалось загрузить аналитику');
  });
});
```

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Implement**

`api/useAnalyticsRequest.ts`:

```ts
import type { AnalyticsOverview, AnalyticsQuery } from '@contract/api.ts';
import { balanceApi } from '@/shared/api';

export function useAnalyticsRequest(): { fetchAnalyticsOverview: (q: AnalyticsQuery) => Promise<AnalyticsOverview> } {
  return { fetchAnalyticsOverview: (q) => balanceApi.getAnalyticsOverview(q) };
}
```

`composables/useAnalytics.ts` (like `useIncomeDetail`):

```ts
import { computed, ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { useMoneyFormat } from '@/entities/currency-display';
import { useParticipantStore } from '@/entities/participant';
import { useRangeStore } from '@/entities/period';
import { useSyncStatusStore } from '@/entities/sync-status';
import { useAsyncData } from '@/shared/lib';
import { useAnalyticsRequest } from '../api/useAnalyticsRequest.ts';
import { DEFAULT_LINES } from '../constants.ts';
import type { LinesMode, ViewId } from '../types.ts';
import { categoryRows } from '../utils.ts';

/** The analytics of the picked period and person: reloads when either changes, quietly when the data changes; the views' state. */
export function useAnalytics() {
  const { fetchAnalyticsOverview } = useAnalyticsRequest();
  const syncStatus = useSyncStatusStore();
  const participant = useParticipantStore();
  const { range } = storeToRefs(useRangeStore());
  const { state } = useAsyncData(
    () => {
      const id = participant.selectedId;
      return fetchAnalyticsOverview({ from: range.value.from, to: range.value.to, ...(id !== null ? { participantId: id } : {}) });
    },
    [range, () => participant.selectedId],
    { quiet: [() => syncStatus.version] },
  );
  const fmt = useMoneyFormat(() => state.value.data?.rates);
  const view = computed(() => state.value.data);
  const rows = computed(() => (view.value ? categoryRows(view.value.categories, view.value.buckets.length) : []));

  const current = ref<ViewId>('heat');
  const on = ref(new Set<string>());
  const hover = ref<string | null>(null);
  const mode = ref<LinesMode>('amount');
  const topLines = () => new Set(rows.value.slice(0, DEFAULT_LINES).map((r) => r.key));
  // A new period ranks the categories anew: the default lines follow it.
  watch(rows, () => (on.value = topLines()), { immediate: true });

  return {
    state, view, rows, fmt, current, on, hover, mode,
    showOnly: (key: string) => ((on.value = new Set([key])), (current.value = 'lines')),
    toggle: (key: string) => {
      const next = new Set(on.value);
      if (!next.delete(key)) next.add(key);
      on.value = next;
    },
    top: () => (on.value = topLines()),
    all: () => (on.value = new Set(rows.value.map((r) => r.key))),
  };
}
```

Components (Tailwind classes as the other features; texts via `$t`; every chart canvas has an `sr-only` list saying
the same — as `MonthsChart` does):

- `AnalyticsKpis.vue` — props `items: KpiView[]`; a 4-column grid (2 columns under `sm`), each card
  `data-test="kpi"`: label (muted, sm), value (xl, bold, tabular), note coloured by tone (`good` → `text-success`,
  `bad` → `text-danger`, else muted).
- `FlowChart.vue` — props `view`, `fmt`; card with title, subtitle (`subtitleDays` / `subtitleMonths`), a legend
  (income, spending, and «usual» dashed for one month), `<VChart :option="flowChartOption(view, fmt)" class="h-72" />`,
  `sr-only` list «month: income, spending».
- `ChangesList.vue` — props `rows: ChangeRow[]`, `vs: string`; emits `open(key)` and `all()`; each row a `<button
  data-test="change">` with the arrow chip (up → danger subtle, down → success subtle), name, «why», delta and pct;
  `none` text when empty; the «all» link-button under the list.
- `CategoryViews.vue` — props `view`, `rows`, `fmt`, `current`, `on`, `hover`, `mode` (v-models), emits `toggle`, `top`,
  `all`; the header: title, the hint of the current view, `<VSegmentedControl v-model="current" :options>` (icons
  `lucide:grid-3x3`, `lucide:chart-column`, `lucide:chart-spline`, `lucide:arrow-left-right`); below, one of:
  - `HeatmapView.vue` — `role="table"` grid (`grid-template-columns: 10rem repeat(var(--cols), minmax(2.75rem, 1fr)) 4.5rem`,
    in an `overflow-x-auto` box), column headers (`role="columnheader"`), rows (`role="row"`, `display: contents`),
    cells `role="cell"` with `:style="{ background: c.background }"`, bold when `strong`, a dashed outline when
    `running`, `:title`; the legend «less … more» with five swatches; the «avg» column.
  - `SmallChartsView.vue` — a 4-column grid (2 under `md`) of cards `data-test="mini"`: dot, name, the change chip
    (`changeChip` from `@/entities/operations` if its shape fits, else the same colours as `ChangesList`), total, «avg per
    month/day», `<VChart :option="miniOption(view, row)" class="h-20" />`.
  - `LinesView.vue` — the «Amount / Share» `VSegmentedControl size="sm"`, «Top 5» / «All» buttons, the chart
    (`linesOption`), chips `data-test="line-chip"` (`aria-pressed`, dot, name, total) with `@mouseenter` / `@mouseleave`
    setting `hover`, `@click` → `toggle`.
  - `CompareView.vue` — rows as in the mockup: name, the bar box (centre line, the bar `left` / `width` in %,
    `--heat-hot` up / `--heat-cold` down), delta, «was → now»; the header row «← less / more →».
- `AnalyticsFeature.vue` — loading: `DetailSkeleton` from `@/entities/operations`; failed: the `failed` text; the data:
  `AnalyticsKpis`, then a `flex flex-wrap gap-4` row with `FlowChart` (`flex: 999 1 34rem`) and `ChangesList`
  (`flex: 1 1 18rem`), then `CategoryViews`, then the `leftOut` footnote (`currencySymbol` of each code). An empty period
  (`totals.income === 0 && totals.spending === 0`) shows `empty` under the KPIs instead of the charts.
- `index.ts` — `export { default as AnalyticsFeature } from './AnalyticsFeature.vue';`
- `AnalyticsPage.vue` — `<main class="flex min-h-full flex-col gap-4"><AnalyticsFeature /></main>` (one root element);
  remove `analytics.placeholder.*` from the three dictionaries and any test that reads them.

- [ ] **Step 4: Run** `tests/renderer/analytics.test.ts`, `tests/pages.test.ts`, `tests/architecture.test.ts`,
  `tests/i18n.test.ts`, the renderer typecheck. Expect PASS.
- [ ] **Step 5: Commit** — `feat(desktop): the analytics screen — KPIs, income and spending, what changed, four category views`

---

### Task 11: Docs, changelog, full check

- [ ] **Step 1: `CHANGELOG.md`**, under `## 0.1.8 — unreleased`, a new section:

```md
### «Analytics»

- The «Analytics» screen: income, spending, what is left and the savings rate for a month or a range of months, compared
  with the period before; income and spending month by month (or day by day for one month, with your usual month for
  reference); the categories that changed most; and the categories as a heatmap of unusual months, small charts, lines
  you can switch on and off, or a comparison with the period before.
- A period picker on that screen: one month or a range, with quick picks (3–36 months, since January, last year, all time).
```

- [ ] **Step 2: Agent docs** (English):
  - `.agents/project/desktop-import.md` — in the data channels paragraph: `getAnalyticsOverview({ from, to, participantId? })`
    (whole months, ≤ `ANALYTICS_MAX_MONTHS`, all scopes — the balances' fold; `DataService.analyticsOverview`, helpers
    `main/analytics.ts`); no bank text.
  - `.agents/project/domain-rules.md` — `spendingGrid` (category × day/month over `spendingLinesSql`, desktop only) and
    `incomeSummary` `groupBy: 'day'` (desktop only).
  - `.agents/project/desktop-renderer.md` — `VMonthRangePicker`; the `periodFilter` route meta; `useRangeStore`;
    `features/analytics-overview` and its views.
  - `CLAUDE.md` — in «Layouts»: «Analytics» is a real screen now (not a placeholder) and the global filters show the
    period button on routes with `meta.periodFilter: 'range'`.
  - `docs/backlog.md` — the spec's «Out of scope» items; «not checked on a live system: the analytics screen».
- [ ] **Step 3: Full checks** at the root: `pnpm --config.verify-deps-before-run=false test`, then
  `pnpm --config.verify-deps-before-run=false typecheck`. Both must pass.
- [ ] **Step 4: Commit** — `docs: the analytics screen in the changelog and the agent docs`

---

## Self-review notes

- Spec coverage: KPIs (T8/T10), flow chart with gap and usual month (T3/T8/T9/T10), «What changed» + jump to lines
  (T8/T10), four views incl. weeks for one month (T8–T10), picker with one month on one click, quick picks, note, draft
  (T5/T6), route-dependent filter (T6), data rules and no bank text (T1–T4), docs (T11).
- Known judgement calls left to the implementer, each with a stated fallback: reka `MonthRangePicker`'s first-click
  event (T5 step 4), the custom series in the CSP bundle test (T7 step 2), the balances' spending rule for negative-net
  categories (T3 step 3).
