# Spending Block Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the home «Spending» table with the block of the spec `docs/superpowers/specs/2026-10-02-spending-block-design.md`:
a category ring, categories with share, operations and the change since last month, the family's people (pick a person,
expand a category to see who spent what), a settings menu (people split, last month's mark, $ / € lines).

**Architecture:** The core gets one field (`purchases`). Main gets one read method, `DataService.spendingOverview`, that
runs the existing `spendingSummary` for the month, the comparison period and each person, folds account currencies into
hryvnia by the user's own exchange rates, and returns one narrow view (`SpendingOverview`) over a new IPC
`getSpendingOverview` (it replaces `spendingSummary`). The renderer slice `features/spending-summary` is rewritten:
pure helpers in `utils.ts` turn the view + the in-block pick into rows; a Pinia store keeps the menu choices in
`localStorage`; display components render them. A popover (`VPopover`, ours on reka-ui) is added to `shared/ui`.

**Tech Stack:** TypeScript, libsql (core aggregates), Electron IPC with zod, Vue 3.5 + Pinia + vue-i18n, Tailwind v4,
reka-ui (inside `shared/ui` only), vitest (+ `@vue/test-utils` / `happy-dom` for the one component test).

**Rules that apply to every task** (root `CLAUDE.md`, `.agents/project/desktop-renderer.md`):
- English in code, comments, docs and commit messages; UI texts only through i18n (`uk.json` reference + `en.json` +
  `ru.json` in the same change).
- No real data: tests use fictional fixtures only.
- Before handing over: `pnpm test` and `pnpm typecheck` at the repo root.
- Commit after each task (Conventional Commits, the attribution trailer from the session).

---

## File map

| File | Change | Responsibility |
|---|---|---|
| `packages/core/src/summaries.ts` | modify | `purchases` on `SpendingGroup` and `CurrencyTotal` |
| `packages/core/tests/summaries.test.ts` | modify | `purchases` tests, totals expectations |
| `apps/desktop/src/shared/api.ts` | modify | `SpendingOverviewQuery`, `SpendingOverview` & parts; `getSpendingOverview` in `BalanceApi`; old spending types removed (Task 12) |
| `apps/desktop/src/shared/channels.ts` | modify | `getSpendingOverview` channel (replaces `spendingSummary` in Task 12) |
| `apps/desktop/src/main/ipc.ts` | modify | zod schema of `getSpendingOverview` |
| `apps/desktop/src/main/index.ts` | modify | handler wiring |
| `apps/desktop/src/main/spending.ts` | create | pure helpers of main: `comparePeriod`, `foldByCategory` |
| `apps/desktop/src/main/data.ts` | modify | `DataService.spendingOverview`; `spending()` removed in Task 12 |
| `apps/desktop/tests/spending-main.test.ts` | create | `comparePeriod`, `foldByCategory` |
| `apps/desktop/tests/data.test.ts` | modify | `spendingOverview` tests; old `spending` tests removed in Task 12 |
| `apps/desktop/tests/ipc.test.ts` | modify | invalid inputs of the new channel |
| `apps/desktop/src/shared/i18n/{uk,en,ru}.json` | modify | `common.monthIn`, `common.monthGen` (moved), `home.spending.*` |
| `apps/desktop/src/renderer/src/features/balances/utils.ts` | modify | reads the moved month keys |
| `apps/desktop/src/renderer/src/shared/ui/components/overlay/VPopover.vue` | create | trigger + panel (reka-ui Popover) |
| `apps/desktop/src/renderer/src/shared/ui/styles/components/overlay/vpopover.scss` | create | its styles |
| `apps/desktop/src/renderer/src/shared/ui/index.ts`, `README.md` | modify | export, «ours» note |
| `apps/desktop/src/renderer/src/shared/ui/components/base/icons.ts` | modify | category icons |
| `apps/desktop/src/renderer/src/app/styles/theme.css` | modify | `--category-1…7` (both themes): the category palette, apart from the people's `--series-*` |
| `apps/desktop/src/renderer/src/features/spending-summary/constants.ts` | modify | `SCOPES`, `TOP`, `CATEGORY_COLORS`, `CATEGORY_ICON`, `FX_CURRENCIES`, `PREFS_KEY` |
| `.../spending-summary/types.ts` | rewrite | view models (`RowView`, `PersonLineView`, `ChipView` …), `UseSpendingReturn` |
| `.../spending-summary/utils.ts` | rewrite | pure helpers |
| `.../spending-summary/store/useSpendingPrefsStore.ts` | create | menu choices in `localStorage` |
| `.../spending-summary/api/useSpendingRequest.ts` | rewrite | `fetchSpendingOverview` |
| `.../spending-summary/composables/useSpending.ts` | rewrite | data, pick, expansion, prefs |
| `.../spending-summary/components/*.vue` | create | `SpendingHeader`, `SpendingSettings`, `ChangeChip`, `CategoryRing`, `PeopleList`, `CategoryRow` |
| `.../spending-summary/SpendingFeature.vue` | rewrite | the block |
| `apps/desktop/tests/renderer/spending.test.ts` | create | pure helpers, prefs parsing |
| `apps/desktop/tests/renderer/spending-feature.test.ts` | create | the feature mounted (happy-dom) |
| `.agents/project/desktop-renderer.md`, `.agents/project/domain-rules.md`, `CHANGELOG.md` | modify | docs |

---

### Task 1: `purchases` in the core spending aggregate

**Files:**
- Modify: `packages/core/src/summaries.ts` (types at ~147–175, SQL at ~232–246, mapping at ~250–270, `currencyTotals` at ~290–310)
- Test: `packages/core/tests/summaries.test.ts`

- [ ] **Step 1: Write the failing test** — add inside `describe('spendingSummary', …)` (after the first `it`), using the
  existing `beforeEach` fixture:

```ts
  it('purchases: spending lines only — a refund is not an operation, a commission line is one', async () => {
    const s = await spendingSummary(db, Q, NOW);
    expect(s.groups.map(({ currency, key, lines, purchases }) => ({ currency, key, lines, purchases }))).toEqual([
      { currency: 840, key: 'путешествия', lines: 1, purchases: 1 },
      { currency: 980, key: 'переводы людям', lines: 1, purchases: 1 },
      { currency: 980, key: 'продукты', lines: 1, purchases: 1 },
      { currency: 980, key: 'налоги и госплатежи', lines: 1, purchases: 1 },
      { currency: 980, key: 'кафе и рестораны', lines: 2, purchases: 1 },
      { currency: 980, key: 'комиссии банка', lines: 2, purchases: 2 },
    ]);
    expect(s.totals.map(({ currency, purchases }) => ({ currency, purchases }))).toEqual([
      { currency: 840, purchases: 1 },
      { currency: 980, purchases: 6 },
    ]);
  });
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter @mono/core exec vitest run tests/summaries.test.ts -t purchases`
Expected: FAIL — `purchases` is `undefined`.

- [ ] **Step 3: Implement**

In `SpendingGroup` add after `lines`:

```ts
  /** Spending lines (amount < 0): a refund is not an operation; a commission is a line of its own. */
  purchases: number;
```

In `CurrencyTotal` add after `lines: number;`:

```ts
  purchases: number;
```

In the SQL `SELECT currency, ${KEY_SQL[groupBy]} AS k, COUNT(*) AS lines,` append the count:

```sql
          SELECT currency, ${KEY_SQL[groupBy]} AS k, COUNT(*) AS lines,
                 SUM(CASE WHEN amount < 0 THEN 1 ELSE 0 END) AS purchases,
```

In the group mapping, after `lines: Number(r.lines),`:

```ts
      purchases: Number(r.purchases),
```

In `currencyTotals`: the initial object gets `purchases: 0` (after `lines: 0`), and after `t.lines += g.lines;`:

```ts
    t.purchases += g.purchases;
```

- [ ] **Step 4: Fix the existing full-object expectations**

The `totals` assertion of the first `spendingSummary` test (`toEqual([{ currency: 840, lines: 1, … }, { currency: 980, lines: 7, … }])`)
now needs `purchases: 1` and `purchases: 6`. Then run the whole core suite and add `purchases` wherever a test compares a
whole group / total object:

Run: `pnpm --filter @mono/core exec vitest run`
Expected: PASS (after adding the field to any other `toEqual` that lists every key of a group or a total).

- [ ] **Step 5: Check the MCP output is unchanged**

`apps/mcp/src/mcp/tools.ts` maps groups field by field (`lines: g.lines, …`), so `purchases` does not reach MCP.
Run: `pnpm --filter @mono/mcp exec vitest run`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/summaries.ts packages/core/tests/summaries.test.ts
git commit -m "feat(core): purchases — spending lines per group and per currency total"
```

---

### Task 2: the view contract and the IPC channel

**Files:**
- Modify: `apps/desktop/src/shared/api.ts`, `apps/desktop/src/shared/channels.ts`, `apps/desktop/src/main/ipc.ts`,
  `apps/desktop/src/main/index.ts`
- Test: `apps/desktop/tests/ipc.test.ts`

- [ ] **Step 1: Add the types** to `apps/desktop/src/shared/api.ts`, after `SpendingView` (the old types stay until Task 12):

```ts
export type SpendingOverviewQuery = { month: string; scope: Scope; participantId?: number };

/** Hryvnia kopecks (account currencies folded by the user's own exchange rates) and spending lines. */
export type SpendingAmounts = { net: number; purchases: number };

export type SpendingPersonPart = SpendingAmounts & {
  participantId: number;
  /** The comparison period; null — no comparison. */
  prev: SpendingAmounts | null;
};

export type SpendingCategoryView = SpendingAmounts & {
  /** The core's word; `categoryId` — its CATEGORY key (null: a word the core no longer has). */
  category: string;
  categoryId: CategoryId | null;
  prev: SpendingAmounts | null;
  /** The family view only (no participantId): each participant's part, in listParticipants order; else []. */
  people: SpendingPersonPart[];
};

/** A currency the block can show «≈» lines in: kopecks per minor unit, from the user's own exchanges. */
export type SpendingFx = { currency: 840 | 978; rate: number | null; prevRate: number | null; nearest: boolean };

export type SpendingOverview = {
  month: string;
  period: SpendingView['period'];
  /** The period compared with: last month, cut to the same day while this one is incomplete; null — not covered. */
  compare: { from: string; to: string; partial: boolean } | null;
  total: SpendingAmounts & { netPerDay: number | null; prev: SpendingAmounts | null };
  /** Family view only: each participant's sum over the family's categories (they add up to `total`). */
  people: SpendingPersonPart[];
  /** net > 0 only, net desc; a refund-only category is left out here but counts in `total`. */
  categories: SpendingCategoryView[];
  fx: SpendingFx[];
  /** Account currencies without any rate: left out of every sum. Minor units of that currency. */
  leftOut: Array<{ currency: number; net: number }>;
  /** With participantId and more than one participant: the family's net for the same month and scope; else null. */
  familyTotal: number | null;
};
```

In `BalanceApi`, next to `spendingSummary(…)`:

```ts
  getSpendingOverview(q: SpendingOverviewQuery): Promise<SpendingOverview>;
```

- [ ] **Step 2: Add the channel** — in `apps/desktop/src/shared/channels.ts`, add `'getSpendingOverview',` right after
  `'spendingSummary',`.

- [ ] **Step 3: Write the failing IPC test** — in `apps/desktop/tests/ipc.test.ts`, add to `INVALID`:

```ts
    ['getSpendingOverview', []],
    ['getSpendingOverview', [{ month: '2026-09' }]],
    ['getSpendingOverview', [{ month: '2026-9', scope: 'personal' }]],
    ['getSpendingOverview', [{ month: '2026-09', scope: 'all' }]],
    ['getSpendingOverview', [{ month: '2026-09', scope: 'personal', participantId: 0 }]],
    ['getSpendingOverview', [{ month: '2026-09', scope: 'personal', participantId: 1.5 }]],
    ['getSpendingOverview', [{ month: '2026-09', scope: 'personal', extra: 1 }]],
```

Run: `pnpm --filter @mono/desktop exec vitest run tests/ipc.test.ts`
Expected: FAIL — no schema for `getSpendingOverview` (the registration test also fails: a method without a schema).

- [ ] **Step 4: Add the schema** — in `apps/desktop/src/main/ipc.ts`, after `getMonthOverview`:

```ts
  getSpendingOverview: z.tuple([z.strictObject({ month, scope: z.enum(['personal', 'business']), participantId: id.optional() })]),
```

and in `apps/desktop/src/main/index.ts`, after `getMonthOverview: (q) => data.monthOverview(q),`:

```ts
    getSpendingOverview: (q) => data.spendingOverview(q),
```

(`data.spendingOverview` arrives in Task 4; until then add a temporary stub to `DataService` so the typecheck passes:
`async spendingOverview(_q: SpendingOverviewQuery): Promise<SpendingOverview> { throw new Error('not implemented'); }` —
Task 4 replaces it in the same branch.)

- [ ] **Step 5: Run the tests**

Run: `pnpm --filter @mono/desktop exec vitest run tests/ipc.test.ts tests/preload.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/desktop/src/shared apps/desktop/src/main/ipc.ts apps/desktop/src/main/index.ts apps/desktop/src/main/data.ts apps/desktop/tests/ipc.test.ts
git commit -m "feat(desktop): getSpendingOverview — the spending block's view contract and IPC channel"
```

---

### Task 3: pure helpers of main — the comparison period and folding currencies

**Files:**
- Create: `apps/desktop/src/main/spending.ts`
- Test: `apps/desktop/tests/spending-main.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// Pure helpers of the spending block in main: which period is compared, how account currencies fold into hryvnia.
import { describe, expect, it } from 'vitest';
import type { SpendingSummary } from '@mono/core/summaries';
import { comparePeriod, foldByCategory } from '../src/main/spending.ts';

describe('comparePeriod', () => {
  it('a complete month → the whole previous month', () => {
    expect(comparePeriod('2026-02', { incomplete: false, dataUntil: '2026-03-10' }, '2026-01-01')).toEqual({ from: '2026-01-01', to: '2026-01-31', partial: false });
  });
  it('a month in progress → the previous month cut to the same day, clamped to its length', () => {
    expect(comparePeriod('2026-03', { incomplete: true, dataUntil: '2026-03-10' }, '2026-01-01')).toEqual({ from: '2026-02-01', to: '2026-02-10', partial: true });
    expect(comparePeriod('2026-03', { incomplete: true, dataUntil: '2026-03-30' }, '2026-01-01')).toEqual({ from: '2026-02-01', to: '2026-02-28', partial: true });
  });
  it('January compares with December of the year before', () => {
    expect(comparePeriod('2026-01', { incomplete: false, dataUntil: '2026-03-10' }, '2025-06-01')).toEqual({ from: '2025-12-01', to: '2025-12-31', partial: false });
  });
  it('null when the data starts after the previous period starts, or there is no data', () => {
    expect(comparePeriod('2026-01', { incomplete: false, dataUntil: '2026-03-10' }, '2026-01-01')).toBeNull();
    expect(comparePeriod('2026-02', { incomplete: false, dataUntil: '2026-03-10' }, '2026-01-02')).toBeNull();
    expect(comparePeriod('2026-02', { incomplete: true, dataUntil: null }, null)).toBeNull();
  });
  it('an incomplete month whose data ends before it → the whole previous month', () => {
    expect(comparePeriod('2026-04', { incomplete: true, dataUntil: '2026-03-10' }, '2026-01-01')).toEqual({ from: '2026-03-01', to: '2026-03-31', partial: false });
  });
});

const group = (currency: number, key: string, net: number, purchases: number) =>
  ({ currency, key, lines: purchases, purchases, gross: net, refunds: 0, net, netPerDay: null });
const summary = (groups: ReturnType<typeof group>[]) => ({ groups }) as unknown as SpendingSummary;

describe('foldByCategory', () => {
  it('folds a currency with a rate into hryvnia per category; one without a rate is left out', () => {
    const rates = new Map([[840, { rate: 41, nearest: false }]]);
    const f = foldByCategory(summary([group(980, 'продукты', 10_000, 2), group(840, 'продукты', 100, 1), group(840, 'путешествия', 500, 1), group(978, 'кафе', 300, 1)]), rates);
    expect([...f.byCategory]).toEqual([
      ['продукты', { net: 14_100, purchases: 3 }],
      ['путешествия', { net: 20_500, purchases: 1 }],
    ]);
    expect([...f.leftOut]).toEqual([[978, 300]]);
  });
});
```

`as unknown as SpendingSummary` here is a test fixture holding only the fields the helper reads — the one cast the plan
allows (TypeScript rule 8: justified in the comment of the helper's signature).

Run: `pnpm --filter @mono/desktop exec vitest run tests/spending-main.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 2: Implement** `apps/desktop/src/main/spending.ts`:

```ts
// Pure helpers of the spending block in main (DataService.spendingOverview): the period compared with, and folding
// account currencies into hryvnia by the user's own exchange rates.
import { toUah, type FxRate } from '@mono/core/fx';
import type { PeriodInfo, SpendingSummary } from '@mono/core/summaries';
import type { SpendingAmounts } from '../shared/api.ts';

const pad2 = (n: number) => String(n).padStart(2, '0');

function bounds(month: string): { from: string; to: string } {
  const [y, m] = month.split('-').map(Number) as [number, number];
  return { from: `${month}-01`, to: `${month}-${pad2(new Date(Date.UTC(y, m, 0)).getUTCDate())}` };
}

function previous(month: string): string {
  const [y, m] = month.split('-').map(Number) as [number, number];
  const d = new Date(Date.UTC(y, m - 2, 1));
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}`;
}

/**
 * Last month; while `month` is incomplete and its data ends inside it — last month up to the same day (clamped to its
 * length). Null when the data does not cover the previous period's start (or there is no data).
 */
export function comparePeriod(
  month: string,
  p: Pick<PeriodInfo, 'incomplete' | 'dataUntil'>,
  dataFrom: string | null,
): { from: string; to: string; partial: boolean } | null {
  const prev = bounds(previous(month));
  if (dataFrom === null || dataFrom > prev.from) return null;
  if (p.incomplete && p.dataUntil !== null && p.dataUntil.slice(0, 7) === month) {
    const day = Math.min(Number(p.dataUntil.slice(8, 10)), Number(prev.to.slice(8, 10)));
    return { from: prev.from, to: `${prev.from.slice(0, 8)}${pad2(day)}`, partial: true };
  }
  return { ...prev, partial: false };
}

/** The groups (groupBy category) of a summary; the caller passes a SpendingSummary, tests a fixture with these fields. */
type CategoryGroups = Pick<SpendingSummary, 'groups'>;

/** Per category in hryvnia kopecks; a currency without a rate stays out (leftOut: its own minor units). */
export function foldByCategory(
  s: CategoryGroups,
  rates: ReadonlyMap<number, FxRate>,
): { byCategory: Map<string, SpendingAmounts>; leftOut: Map<number, number> } {
  const byCategory = new Map<string, SpendingAmounts>();
  const leftOut = new Map<number, number>();
  for (const g of s.groups) {
    const uah = toUah(g.net, g.currency, rates);
    if (uah === null) {
      leftOut.set(g.currency, (leftOut.get(g.currency) ?? 0) + g.net);
      continue;
    }
    const a = byCategory.get(g.key) ?? { net: 0, purchases: 0 };
    byCategory.set(g.key, { net: a.net + uah, purchases: a.purchases + g.purchases });
  }
  return { byCategory, leftOut };
}
```

(The test's fixture keeps `as unknown as SpendingSummary`; with `CategoryGroups` the helper itself needs no cast. If you
prefer, type the fixture as `CategoryGroups` and drop the cast in the test.)

- [ ] **Step 3: Run the tests**

Run: `pnpm --filter @mono/desktop exec vitest run tests/spending-main.test.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/main/spending.ts apps/desktop/tests/spending-main.test.ts
git commit -m "feat(desktop): spending block in main — the compared period and currency folding"
```

---

### Task 4: `DataService.spendingOverview`

**Files:**
- Modify: `apps/desktop/src/main/data.ts`
- Test: `apps/desktop/tests/data.test.ts`

- [ ] **Step 1: Write the failing tests** — a new `describe` at the end of `apps/desktop/tests/data.test.ts` (it reuses the
  file's `account`, `tx`, `synced`, `svc`, `db`, `CANARIES`; data is synced from 2026-01-01 to 2026-03-10, now is 15.03):

```ts
describe('DataService.spendingOverview', () => {
  const sale = (date: string, uah: number, usd: number) => tx('uah', date, uah, 'свои переводы', { rule: 'pair_fx', op: { currency: 840, amount: -usd } });

  it('one month: categories folded into hryvnia by own exchanges, purchases, net-sorted, per day, fx', async () => {
    await account('uah', 'black', 980, 100_000);
    await account('usd', 'black', 840, 5_000);
    await synced('uah');
    await synced('usd');
    await tx('uah', '2026-02-03', -30_000, 'продукты');
    await tx('uah', '2026-02-04', -10_000, 'продукты');
    await tx('uah', '2026-02-05', -50_000, 'кафе и рестораны');
    await tx('uah', '2026-02-06', 10_000, 'кафе и рестораны'); // refund: not an operation
    await tx('usd', '2026-02-07', -1_000, 'путешествия');
    await sale('2026-02-08', 41_000, 1_000); // 41 kopecks per cent

    const v = await svc.spendingOverview({ month: '2026-02', scope: 'personal' });
    expect(v.month).toBe('2026-02');
    expect(v.categories.map(({ category, categoryId, net, purchases }) => ({ category, categoryId, net, purchases }))).toEqual([
      { category: 'путешествия', categoryId: 'travel', net: 41_000, purchases: 1 },
      { category: 'кафе и рестораны', categoryId: 'cafes', net: 40_000, purchases: 1 },
      { category: 'продукты', categoryId: 'groceries', net: 40_000, purchases: 2 },
    ]);
    expect(v.total).toMatchObject({ net: 121_000, purchases: 4, netPerDay: Math.round(121_000 / 28) });
    expect(v.fx).toEqual([
      { currency: 840, rate: 41, prevRate: 41, nearest: false }, // January had no exchange: the nearest one
      { currency: 978, rate: null, prevRate: null, nearest: false },
    ]);
    expect(v.leftOut).toEqual([]);
    expect(v.familyTotal).toBeNull();
  });

  it('a currency never exchanged stays out of the sums, listed in leftOut', async () => {
    await account('uah', 'black', 980, 0);
    await account('usd', 'black', 840, 0);
    await synced('uah');
    await synced('usd');
    await tx('uah', '2026-02-03', -30_000, 'продукты');
    await tx('usd', '2026-02-07', -1_000, 'путешествия');
    const v = await svc.spendingOverview({ month: '2026-02', scope: 'personal' });
    expect(v.categories.map((c) => c.category)).toEqual(['продукты']);
    expect(v.total.net).toBe(30_000);
    expect(v.leftOut).toEqual([{ currency: 840, net: 1_000 }]);
  });

  it('compare: the whole previous month; the same days while the month is in progress; none before the data', async () => {
    await account('uah', 'black', 980, 0);
    await synced('uah');
    await tx('uah', '2026-01-10', -20_000, 'продукты');
    await tx('uah', '2026-02-05', -30_000, 'продукты');
    await tx('uah', '2026-02-20', -5_000, 'продукты'); // after the 10th: out of March's comparison
    await tx('uah', '2026-03-02', -7_000, 'продукты');

    const feb = await svc.spendingOverview({ month: '2026-02', scope: 'personal' });
    expect(feb.compare).toEqual({ from: '2026-01-01', to: '2026-01-31', partial: false });
    expect(feb.categories[0]).toMatchObject({ net: 35_000, purchases: 2, prev: { net: 20_000, purchases: 1 } });
    expect(feb.total.prev).toEqual({ net: 20_000, purchases: 1 });

    const mar = await svc.spendingOverview({ month: '2026-03', scope: 'personal' });
    expect(mar.compare).toEqual({ from: '2026-02-01', to: '2026-02-10', partial: true });
    expect(mar.total.prev).toEqual({ net: 30_000, purchases: 1 });

    const jan = await svc.spendingOverview({ month: '2026-01', scope: 'personal' });
    expect(jan.compare).toBeNull();
    expect(jan.total.prev).toBeNull();
    expect(jan.categories[0]!.prev).toBeNull();
  });

  it('family: each person part per category adds up to the total; a person view has no parts but the family total', async () => {
    await account('uah', 'black', 980, 0);
    await synced('uah');
    const her = Number((await db.execute(`INSERT INTO participants (label, color, created_at) VALUES ('Вигадана', 'aqua', 0) RETURNING id`)).rows[0]?.id);
    const conn = Number((await db.execute({ sql: `INSERT INTO connections (participant_id, provider, created_at) VALUES (?, 'monobank', 0) RETURNING id`, args: [her] })).rows[0]?.id);
    await insertAccountRow(db, { id: 'hers', connection_id: conn, kind: 'card', type: 'white', currency_code: 980, balance: 0, updated_at: SYNCED_TO });
    await synced('hers');
    const me = Number((await db.execute('SELECT id FROM participants ORDER BY id LIMIT 1')).rows[0]?.id);
    await tx('uah', '2026-02-03', -30_000, 'продукты');
    await tx('hers', '2026-02-04', -20_000, 'продукты');
    await tx('hers', '2026-02-05', -5_000, 'кафе и рестораны');

    const family = await svc.spendingOverview({ month: '2026-02', scope: 'personal' });
    expect(family.categories.map((c) => [c.category, c.people.map((p) => [p.participantId, p.net, p.purchases])])).toEqual([
      ['продукты', [[me, 30_000, 1], [her, 20_000, 1]]],
      ['кафе и рестораны', [[me, 0, 0], [her, 5_000, 1]]],
    ]);
    expect(family.people.map((p) => [p.participantId, p.net, p.purchases])).toEqual([[me, 30_000, 1], [her, 25_000, 2]]);
    expect(family.people.reduce((s, p) => s + p.net, 0)).toBe(family.total.net);
    expect(family.familyTotal).toBeNull();

    const person = await svc.spendingOverview({ month: '2026-02', scope: 'personal', participantId: her });
    expect(person.categories.every((c) => c.people.length === 0)).toBe(true);
    expect(person.people).toEqual([]);
    expect(person.total.net).toBe(25_000);
    expect(person.familyTotal).toBe(55_000);
  });

  it('scope: business spending only in the business view', async () => {
    await account('uah', 'black', 980, 0);
    await account('fop', 'fop', 980, 0);
    await synced('uah');
    await synced('fop');
    await tx('uah', '2026-02-03', -30_000, 'продукты');
    await tx('fop', '2026-02-03', -70_000, 'налоги и госплатежи', { scope: 'business' });
    expect((await svc.spendingOverview({ month: '2026-02', scope: 'business' })).categories.map((c) => c.category)).toEqual(['налоги и госплатежи']);
  });

  it('never carries names, descriptions, card numbers, IBANs or jar titles', async () => {
    await account('uah', 'black', 980, 0);
    await synced('uah');
    await tx('uah', '2026-02-03', -30_000, 'продукты');
    const json = JSON.stringify(await svc.spendingOverview({ month: '2026-02', scope: 'personal' }));
    for (const c of CANARIES) expect(json).not.toContain(c);
  });
});
```

If `insertAccountRow` is not imported at the top of the file yet, it is (`import { insertAccountRow, memoryDb } from '@mono/core/test-helpers';`).

Run: `pnpm --filter @mono/desktop exec vitest run tests/data.test.ts -t spendingOverview`
Expected: FAIL — `not implemented` (the stub of Task 2).

- [ ] **Step 2: Implement** — in `apps/desktop/src/main/data.ts`:

Imports (add to the existing ones):

```ts
import { comparePeriod, foldByCategory } from './spending.ts';
import type { SpendingAmounts, SpendingCategoryView, SpendingFx, SpendingOverview, SpendingOverviewQuery, SpendingPersonPart } from '../shared/api.ts';
```

Constants next to `UAH`:

```ts
/** The currencies the spending block can add «≈» lines in. */
const FX_CURRENCIES = [840, 978] as const;
```

Replace the Task 2 stub with:

```ts
  /**
   * The spending block: the month's categories in hryvnia (account currencies folded by the user's own exchanges),
   * spending lines, the compared period, and — for the whole family — each participant's part of every category.
   */
  async spendingOverview(q: SpendingOverviewQuery): Promise<SpendingOverview> {
    const db = await this.conn();
    const now = this.d.nowSec();
    const period = monthBounds(q.month);
    const status = await this.status();
    const summary = (p: { from: string; to: string }, participantId?: number) =>
      spendingSummary(db, { ...p, groupBy: 'category', scope: q.scope, ...(participantId !== undefined ? { participantId } : {}) }, now);

    const head = await summary(period, q.participantId);
    const compare = comparePeriod(q.month, head.period, status.dataFrom);
    const rates = await exchangeRates(db, period);
    const prevRates = compare ? await exchangeRates(db, compare) : null;
    const cur = foldByCategory(head, rates);
    const prev = compare && prevRates ? foldByCategory(await summary(compare, q.participantId), prevRates).byCategory : null;

    const zero: SpendingAmounts = { net: 0, purchases: 0 };
    const sum = (m: ReadonlyMap<string, SpendingAmounts>, keys?: Iterable<string>): SpendingAmounts => {
      let net = 0;
      let purchases = 0;
      for (const k of keys ?? m.keys()) {
        const a = m.get(k);
        if (a) (net += a.net), (purchases += a.purchases);
      }
      return { net, purchases };
    };

    const participants = await listParticipants(db);
    const split = q.participantId === undefined;
    const parts = split
      ? await Promise.all(
          participants.map(async (p) => ({
            id: p.id,
            cur: foldByCategory(await summary(period, p.id), rates).byCategory,
            prev: compare && prevRates ? foldByCategory(await summary(compare, p.id), prevRates).byCategory : null,
          })),
        )
      : [];

    const categories: SpendingCategoryView[] = [...cur.byCategory]
      .filter(([, a]) => a.net > 0)
      .sort(([ka, a], [kb, b]) => b.net - a.net || (ka < kb ? -1 : 1))
      .map(([category, a]) => ({
        category,
        categoryId: CATEGORY_ID.get(category) ?? null,
        ...a,
        prev: prev ? (prev.get(category) ?? zero) : null,
        people: parts.map((p) => ({
          participantId: p.id,
          ...(p.cur.get(category) ?? zero),
          prev: p.prev ? (p.prev.get(category) ?? zero) : null,
        })),
      }));

    // A person's total is their sum over the family's categories: the people add up to the family's total.
    const people: SpendingPersonPart[] = parts.map((p) => ({
      participantId: p.id,
      ...sum(p.cur, cur.byCategory.keys()),
      prev: p.prev && prev ? sum(p.prev, prev.keys()) : null,
    }));

    const total = sum(cur.byCategory);
    const fx: SpendingFx[] = FX_CURRENCIES.map((c) => ({
      currency: c,
      rate: rates.get(c)?.rate ?? null,
      prevRate: prevRates?.get(c)?.rate ?? null,
      nearest: rates.get(c)?.nearest ?? false,
    }));
    const familyTotal =
      q.participantId !== undefined && participants.length > 1 ? sum(foldByCategory(await summary(period), rates).byCategory).net : null;

    const { from, to, days, incomplete, dataUntil, coveredDays, pendingHolds } = head.period;
    return {
      month: q.month,
      period: { from, to, days, incomplete, dataUntil, coveredDays, pendingHolds },
      compare,
      total: { ...total, netPerDay: coveredDays > 0 ? Math.round(total.net / coveredDays) : null, prev: prev ? sum(prev) : null },
      people,
      categories,
      fx,
      leftOut: [...cur.leftOut].sort(([a], [b]) => a - b).map(([currency, net]) => ({ currency, net })),
      familyTotal,
    };
  }
```

Note: `Promise.all` over participants runs several queries on one connection; libsql serialises them. If the test
helpers' memory db complains, switch the `map` to a `for … of` loop (as `monthOverview` does).

- [ ] **Step 3: Run the tests**

Run: `pnpm --filter @mono/desktop exec vitest run tests/data.test.ts`
Expected: PASS. If the family test shows a third participant or a different order, check `listParticipants` order (by
id) and the default participant «Я» created by the migrations — the expected arrays use `me` and `her` read from the db.

- [ ] **Step 4: Typecheck**

Run: `pnpm --filter @mono/desktop typecheck`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/main/data.ts apps/desktop/tests/data.test.ts
git commit -m "feat(desktop): spendingOverview — categories in hryvnia, last month, each person's part"
```

---

### Task 5: dictionaries

**Files:**
- Modify: `apps/desktop/src/shared/i18n/uk.json`, `en.json`, `ru.json`
- Modify: `apps/desktop/src/renderer/src/features/balances/utils.ts` (moved month keys)
- Test: `apps/desktop/tests/i18n.test.ts` (existing; checks keys, placeholders and plural forms)

- [ ] **Step 1: Move the month case forms to `common`** — `home.balances.monthIn` and `home.balances.monthGen` are now
  used by two slices. Run once, at the repo root:

```bash
node -e '
const fs = require("fs");
for (const l of ["uk", "en", "ru"]) {
  const p = `apps/desktop/src/shared/i18n/${l}.json`;
  const j = JSON.parse(fs.readFileSync(p, "utf8"));
  j.common.monthIn = j.home.balances.monthIn; delete j.home.balances.monthIn;
  j.common.monthGen = j.home.balances.monthGen; delete j.home.balances.monthGen;
  fs.writeFileSync(p, JSON.stringify(j, null, 2) + "\n");
}'
```

Check the key order of the files afterwards (`git diff` — the dictionaries are sorted alphabetically; move the two
blocks into place inside `common` by hand if the script appended them at the end).

In `features/balances/utils.ts` replace `home.balances.monthGen.` with `common.monthGen.` and `home.balances.monthIn.`
with `common.monthIn.`.

- [ ] **Step 2: Replace `home.spending`** in each dictionary. Keep `category.*`, `scope.*`, `title`, `empty`, `failed`,
  `importing`, `noData`, `notYet`, `partial`, `pending`; remove `accountsIn`, `column`, `perDay`, `perDayCovered`,
  `total`; change `footnote`; add the rest. Final block, **en.json**:

```json
    "spending": {
      "category": { "…": "unchanged" },
      "change": {
        "less": "{pct}% less than in {month}",
        "lessPartial": "{pct}% less than by this day in {month}",
        "more": "{pct}% more than in {month}",
        "morePartial": "{pct}% more than by this day in {month}",
        "new": "new",
        "same": "as in {month}"
      },
      "empty": "No spending this month.",
      "failed": "Could not count the spending. Try again or restart the app.",
      "familyShare": "{pct}% of the family's spending",
      "familyTotal": "family — {amount}",
      "footnote": "Spending is what was charged minus refunds. Transfers between your own accounts and income are not spending. Spending in other currencies is counted in hryvnia at the rate of your own exchanges.",
      "importing": "Import in progress — the numbers fill in as the statement downloads.",
      "inCurrencyTitle": "In {month} ≈ {amount} (rate {prevRate} ₴, now {rate} ₴)",
      "inMonth": "In {month}",
      "leftOut": "+ {amount} without an exchange rate — not in the totals",
      "markTitle": "In {month} — {amount}",
      "noCompare": "No data for {month} to compare",
      "noData": "No data yet: download the statement in «Import».",
      "notYet": "Data is downloaded only up to {date}: there is none for this month yet.",
      "operations": "Operations",
      "ops": "{n} operation | {n} operations | {n} operations",
      "opsPrev": "In {month} — {ops}",
      "opsShort": "{n} op.",
      "opsVs": "{diff} vs {month}",
      "opsSame": "same",
      "partial": "The month is not complete: data up to {date}, the numbers will still grow.",
      "pending": "Transactions still being processed by the bank: {count} — their amounts may still change.",
      "perDay": "{amount} a day",
      "personShare": "{pct}% · {ops}",
      "rest": "Other · {n}",
      "scope": { "business": "Business", "personal": "Personal" },
      "settings": {
        "bars": "Show on the bars",
        "button": "Block settings",
        "currency": "Also show in currency",
        "currencyNote": "Totals stay in hryvnia",
        "eur": "Euro €",
        "mark": "Last month's mark",
        "markHint": "A tick at last month's amount",
        "noRate": "No exchanges in {symbol} yet",
        "rateHint": "At the rate of your own exchanges this month",
        "split": "Who spent how much",
        "splitHint": "The bar is split by people's colours",
        "usd": "Dollars $"
      },
      "title": "Spending",
      "together": "together · {ops}",
      "whole": "Whole family"
    }
```

**ru.json** (the renderer tests read Russian):

```json
      "change": {
        "less": "на {pct}% меньше, чем в {month}",
        "lessPartial": "на {pct}% меньше, чем к этому дню в {month}",
        "more": "на {pct}% больше, чем в {month}",
        "morePartial": "на {pct}% больше, чем к этому дню в {month}",
        "new": "новое",
        "same": "как в {month}"
      },
      "familyShare": "{pct}% трат семьи",
      "familyTotal": "семья — {amount}",
      "footnote": "Траты — это списания минус возвраты. Переводы между своими счетами и поступления тратами не считаются. Траты в валюте пересчитаны в гривну по курсу твоих обменов.",
      "inCurrencyTitle": "В {month} ≈ {amount} (курс {prevRate} ₴, сейчас {rate} ₴)",
      "inMonth": "В {month}",
      "leftOut": "+ {amount} без курса — не в итогах",
      "markTitle": "В {month} — {amount}",
      "noCompare": "Нет данных за {month} для сравнения",
      "operations": "Операций",
      "ops": "{n} операция | {n} операции | {n} операций",
      "opsPrev": "В {month} — {ops}",
      "opsShort": "{n} оп.",
      "opsVs": "{diff} к {month}",
      "opsSame": "столько же",
      "perDay": "{amount} в день",
      "personShare": "{pct}% · {ops}",
      "rest": "Остальное · {n}",
      "settings": {
        "bars": "Показывать на полосках",
        "button": "Настройки блока",
        "currency": "Показывать рядом в валюте",
        "currencyNote": "Итоги остаются в гривне",
        "eur": "Евро €",
        "mark": "Метка прошлого месяца",
        "markHint": "Чёрточка — сколько было в прошлом месяце",
        "noRate": "Обменов в {symbol} ещё не было",
        "rateHint": "По курсу твоих обменов за месяц",
        "split": "Кто сколько потратил",
        "splitHint": "Полоска делится цветами людей",
        "usd": "Доллары $"
      },
      "together": "вместе · {ops}",
      "whole": "Вся семья"
```

**uk.json** (the reference; informal «ти»):

```json
      "change": {
        "less": "на {pct}% менше, ніж у {month}",
        "lessPartial": "на {pct}% менше, ніж до цього дня у {month}",
        "more": "на {pct}% більше, ніж у {month}",
        "morePartial": "на {pct}% більше, ніж до цього дня у {month}",
        "new": "нове",
        "same": "як у {month}"
      },
      "familyShare": "{pct}% витрат родини",
      "familyTotal": "родина — {amount}",
      "footnote": "Витрати — це списання мінус повернення. Перекази між своїми рахунками та надходження витратами не вважаються. Витрати у валюті перераховані в гривню за курсом твоїх обмінів.",
      "inCurrencyTitle": "У {month} ≈ {amount} (курс {prevRate} ₴, зараз {rate} ₴)",
      "inMonth": "У {month}",
      "leftOut": "+ {amount} без курсу — не в підсумках",
      "markTitle": "У {month} — {amount}",
      "noCompare": "Немає даних за {month} для порівняння",
      "operations": "Операцій",
      "ops": "{n} операція | {n} операції | {n} операцій",
      "opsPrev": "У {month} — {ops}",
      "opsShort": "{n} оп.",
      "opsVs": "{diff} до {month}",
      "opsSame": "стільки ж",
      "perDay": "{amount} на день",
      "personShare": "{pct}% · {ops}",
      "rest": "Інше · {n}",
      "settings": {
        "bars": "Показувати на смужках",
        "button": "Налаштування блоку",
        "currency": "Показувати поруч у валюті",
        "currencyNote": "Підсумки залишаються в гривні",
        "eur": "Євро €",
        "mark": "Позначка минулого місяця",
        "markHint": "Рисочка — скільки було минулого місяця",
        "noRate": "Обмінів у {symbol} ще не було",
        "rateHint": "За курсом твоїх обмінів за місяць",
        "split": "Хто скільки витратив",
        "splitHint": "Смужка ділиться кольорами людей",
        "usd": "Долари $"
      },
      "together": "разом · {ops}",
      "whole": "Уся родина"
```

`{month}` in `change.*`, `inMonth`, `markTitle`, `opsPrev`, `inCurrencyTitle` is `common.monthIn.N` (prepositional:
«августе», «серпні», «August»); in `noCompare` — the nominative `common.month.N` lower-cased; in `opsVs` —
`common.monthShort.N`. Check the plural count of `ops` matches the other plural keys of each file (`tests/i18n.test.ts`
fails otherwise).

- [ ] **Step 3: Run the dictionary tests**

Run: `pnpm --filter @mono/desktop exec vitest run tests/i18n.test.ts tests/renderer/balances.test.ts`
Expected: PASS. (The old `home.spending.column.*` / `perDay*` are still read by the old `utils.ts` until Task 9 — the
typecheck of `MessageKey` fails there; that is expected and fixed in Task 9. Run `typecheck` only after Task 9.)

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/shared/i18n apps/desktop/src/renderer/src/features/balances/utils.ts
git commit -m "feat(desktop): dictionaries of the new spending block; month case forms move to common"
```

---

### Task 6: `VPopover` in `shared/ui`

muzakit has no popover / dropdown menu we could copy (checked: `shared/ui/README.md` lists what was copied; the month
picker was built on reka-ui for the same reason). If muzakit gains one before this task, copy it instead per
`ui-component-migration.md`.

**Files:**
- Create: `apps/desktop/src/renderer/src/shared/ui/components/overlay/VPopover.vue`
- Create: `apps/desktop/src/renderer/src/shared/ui/styles/components/overlay/vpopover.scss`
- Modify: `apps/desktop/src/renderer/src/shared/ui/index.ts`, `apps/desktop/src/renderer/src/shared/ui/README.md`

- [ ] **Step 1: The component**

```vue
<!-- built on reka-ui (2026-10-02): Popover. Ours, not copied: muzakit has no popover or dropdown menu.
     An icon-only trigger (label → aria-label) and a panel for any content; Esc and a click outside close it. -->
<script setup lang="ts">
import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from "reka-ui";
import VIcon from "../base/VIcon.vue";

const { icon, label, align = "end" } = defineProps<{
  icon: string;
  /** The trigger's accessible name (it shows the icon only). */
  label: string;
  align?: "start" | "center" | "end";
}>();
const open = defineModel<boolean>("open", { default: false });
</script>

<template>
  <PopoverRoot v-model:open="open">
    <PopoverTrigger class="v-popover__trigger" :aria-label="label">
      <VIcon :icon class="v-popover__icon" />
    </PopoverTrigger>
    <PopoverPortal>
      <PopoverContent as-child :align :side-offset="6">
        <div class="v-popover__content">
          <slot />
        </div>
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>

<style lang="scss" scoped>
@use "../../styles/components/overlay/vpopover.scss";
</style>
```

- [ ] **Step 2: The styles** (`vpopover.scss`; tokens only — `--ui-*`, no raw colours):

```scss
/* Ours, not copied — VPopover is built on reka-ui (see VPopover.vue header). */

.v-popover__trigger {
  display: grid;
  place-items: center;
  width: var(--ui-control-h);
  height: var(--ui-control-h);
  padding: 0;
  border: 0;
  border-radius: var(--ui-radius-lg);
  background: transparent;
  color: var(--ui-foreground-secondary);
  cursor: pointer;
  transition: background-color 120ms ease, color 120ms ease;

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

  @media (hover: hover) and (pointer: fine) {
    &:hover {
      background: var(--ui-surface-hover);
      color: var(--ui-foreground);
    }
  }

  &[data-state="open"] {
    background: var(--ui-surface-hover);
    color: var(--ui-foreground);
  }

  &:focus-visible {
    outline: none;
    box-shadow: 0 0 0 2px var(--ui-ring);
  }
}

.v-popover__icon {
  width: 1rem;
  height: 1rem;
}

.v-popover__content {
  z-index: 50;
  min-width: 18rem;
  max-width: 20rem;
  padding: var(--ui-space-xs);
  border: 1px solid var(--ui-border);
  border-radius: var(--ui-radius-xl);
  background: var(--ui-surface-raised);
  box-shadow: var(--ui-shadow-lg);
  color: var(--ui-foreground);
}
```

(If a token named here is missing in `shared/ui/styles/tokens.css`, use the nearest existing one from the list in
`ui-component-migration.md` — do not add a raw value.)

- [ ] **Step 3: Export and document**

`index.ts`, after `VTooltip`:

```ts
export { default as VPopover } from "./components/overlay/VPopover.vue";
```

`README.md`, in the list of our own components (next to `VMonthPicker`):

```md
- `VPopover` — an icon-only trigger and a panel on reka-ui's `Popover` (muzakit has no popover or dropdown menu); the
  spending block's settings menu.
```

- [ ] **Step 4: Run the UI tests**

Run: `pnpm --filter @mono/desktop exec vitest run tests/ui.test.ts tests/architecture.test.ts tests/styles.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/renderer/src/shared/ui
git commit -m "feat(desktop): VPopover — an icon trigger and a panel (reka-ui Popover)"
```

---

### Task 7: category icons, the category palette, the slice's constants and types

**Files:**
- Modify: `apps/desktop/src/renderer/src/shared/ui/components/base/icons.ts`
- Modify: `apps/desktop/src/renderer/src/app/styles/theme.css`
- Modify: `apps/desktop/src/renderer/src/features/spending-summary/constants.ts`
- Rewrite: `apps/desktop/src/renderer/src/features/spending-summary/types.ts`

- [ ] **Step 1: Register the icons** — in `icons.ts` import and add (alphabetical, canonical Lucide names) every icon
  of `CATEGORY_ICON` below that is not there yet: `arrow-left-right`, `banknote`, `bus`, `circle-ellipsis`,
  `clapperboard`, `coffee`, `credit-card`, `dumbbell`, `gift`, `graduation-cap`, `hand-heart`, `heart-pulse`, `list`,
  `package`, `paw-print`, `percent`, `plane`, `shirt`, `shopping-cart`, `smartphone`, `sofa`, `truck`, `zap` (plus the
  existing `landmark`, `send`, `shield-check`, `sparkles`, `users`, `wallet`, `settings`, `chevron-right`,
  `arrow-up-right`, `arrow-down-right`). Example of one:

```ts
import LucideShoppingCart from "~icons/lucide/shopping-cart";
// …
  "lucide:shopping-cart": LucideShoppingCart,
```

- [ ] **Step 1b: The category palette** — categories get their own colours, apart from the people's `--series-*`
  (the user's decision: a category and a person never share a colour). People are saturated; categories are muted and
  take the hues between the people's. In `theme.css`, right after the `--series-red` line of the **light** block:

```css
    /* ─── Category palette: the spending block's categories by rank — muted, the hues between the people's series ─── */
    --category-1: oklch(60% 0.11 220);
    --category-2: oklch(64% 0.13 120);
    --category-3: oklch(56% 0.13 320);
    --category-4: oklch(64% 0.09 65);
    --category-5: oklch(52% 0.07 265);
    --category-6: oklch(60% 0.08 185);
    --category-7: oklch(58% 0.08 10);
```

  and after `--series-red` of the **dark** block:

```css
    /* ─── Category palette (see the light theme) ─── */
    --category-1: oklch(68% 0.11 220);
    --category-2: oklch(72% 0.13 120);
    --category-3: oklch(66% 0.13 320);
    --category-4: oklch(72% 0.09 65);
    --category-5: oklch(62% 0.08 265);
    --category-6: oklch(68% 0.08 185);
    --category-7: oklch(67% 0.08 10);
```

  Run `pnpm --filter @mono/desktop exec vitest run tests/styles.test.ts` — PASS (if it checks that both themes define
  the same custom properties, both blocks above satisfy it).

- [ ] **Step 2: Constants** — replace `features/spending-summary/constants.ts`:

```ts
import type { CategoryId } from '@contract/categories.ts';
import type { Scope } from '@contract/api.ts';
import type { MessageKey } from '@contract/i18n/index.ts';

/** The scope switch; labels are dictionary keys, the feature translates them. */
export const SCOPES: ReadonlyArray<{ label: MessageKey; value: Scope }> = [
  { label: 'home.spending.scope.personal', value: 'personal' },
  { label: 'home.spending.scope.business', value: 'business' },
];

/** Categories named one by one; the rest is one «Other · N» line. */
export const TOP = 7;

/** Category colours by rank in the family's order (theme.css `--category-N`, apart from the people's colours); the rest is grey. */
export const CATEGORY_COLORS: ReadonlyArray<string> = Array.from({ length: TOP }, (_, i) => `var(--category-${i + 1})`);

/** Change under this share of last month reads «as in August». */
export const SAME_SHARE = 0.03;

export const CATEGORY_ICON: Readonly<Record<CategoryId | 'rest', string>> = {
  groceries: 'lucide:shopping-cart', cafes: 'lucide:coffee', transport: 'lucide:bus', health: 'lucide:heart-pulse',
  beauty: 'lucide:sparkles', clothing: 'lucide:shirt', home: 'lucide:sofa', telecom: 'lucide:smartphone',
  entertainment: 'lucide:clapperboard', travel: 'lucide:plane', sport: 'lucide:dumbbell', pets: 'lucide:paw-print',
  insurance: 'lucide:shield-check', taxes: 'lucide:landmark', cash: 'lucide:banknote', delivery: 'lucide:truck',
  education: 'lucide:graduation-cap', gifts: 'lucide:gift', utilities: 'lucide:zap', marketplaces: 'lucide:package',
  charity: 'lucide:hand-heart', fees: 'lucide:percent', p2p: 'lucide:send', family: 'lucide:users',
  installments: 'lucide:credit-card', ownTransfers: 'lucide:arrow-left-right', income: 'lucide:wallet',
  other: 'lucide:circle-ellipsis', rest: 'lucide:list',
};

/** The «≈» currencies and their switch labels, in menu order. */
export const FX_CURRENCIES: ReadonlyArray<{ currency: 840 | 978; key: 'usd' | 'eur'; label: MessageKey }> = [
  { currency: 840, key: 'usd', label: 'home.spending.settings.usd' },
  { currency: 978, key: 'eur', label: 'home.spending.settings.eur' },
];

/** localStorage key of the menu choices (a convenience: defaults when storage is unavailable). */
export const PREFS_KEY = 'spending.view';
```


- [ ] **Step 3: Types** — replace `features/spending-summary/types.ts`:

```ts
import type { ComputedRef, Ref } from 'vue';
import type { Scope, SpendingOverview } from '@contract/api.ts';
import type { Loadable, YearMonth } from '@/shared/lib';

/** A change chip: the text and its tone; `arrow` — show the up / down arrow. */
export interface ChipView {
  text: string;
  tone: 'up' | 'down' | 'neutral';
  arrow: 'up' | 'down' | null;
  title?: string;
}

/** «38 операций» and its small difference («+2», «столько же», «новое»; empty — no comparison). */
export interface OpsView {
  text: string;
  diff: string;
  tone: 'up' | 'down' | 'neutral';
  title: string;
}

export interface BarSegment {
  /** flex-grow weight */
  value: number;
  color: string;
  title: string;
}

export interface PersonLineView {
  participantId: number;
  name: string;
  initial: string;
  color: string;
  amount: string;
  conv: string[];
  ops: OpsView;
  chip: ChipView | null;
  /** % of the largest person's amount in this category; mark — last month's (null: no tick). */
  width: number;
  mark: number | null;
  markTitle: string;
  faded: boolean;
}

export interface RowView {
  key: string;
  name: string;
  icon: string;
  color: string;
  share: string;
  amount: string;
  conv: string[];
  ops: OpsView;
  chip: ChipView | null;
  /** % of the largest row (this month or last); mark — last month's position. */
  width: number;
  mark: number | null;
  markTitle: string;
  segments: BarSegment[];
  people: PersonLineView[];
}

export interface PersonRowView {
  /** null — «Whole family». */
  participantId: number | null;
  name: string;
  initial: string;
  color: string;
  /** The family row: every person's colour. */
  dots: string[];
  caption: string;
  amount: string;
  chip: ChipView | null;
  pressed: boolean;
}

export interface SpendingPrefs {
  split: boolean;
  mark: boolean;
  usd: boolean;
  eur: boolean;
}

/** A person as the block shows them (from the participant store). */
export interface BlockPerson {
  id: number;
  name: string;
  color: string;
}

export interface UseSpendingReturn {
  month: Readonly<Ref<YearMonth>>;
  scope: Ref<Scope>;
  state: Readonly<Ref<Loadable<SpendingOverview>>>;
  view: ComputedRef<SpendingOverview | null>;
  periodNote: ComputedRef<string | null>;
  importing: ComputedRef<boolean>;
  /** The global filter is «Whole family» and there is more than one person. */
  family: ComputedRef<boolean>;
  /** One person of a family is picked in the global filter. */
  member: ComputedRef<boolean>;
  people: ComputedRef<ReadonlyArray<BlockPerson>>;
  /** The person the global filter shows (one person of a family, or the only one); null — the whole family. */
  selected: ComputedRef<BlockPerson | null>;
  /** The block's own pick (family view): a participant id or null. */
  pick: Ref<number | null>;
  /** The expanded category key (family view), or null. */
  open: Ref<string | null>;
}
```

- [ ] **Step 4: Commit** (the slice does not compile yet; it is completed by Tasks 8–10 — commit together with Task 8 if
  you prefer a green history)

```bash
git add apps/desktop/src/renderer/src/shared/ui/components/base/icons.ts apps/desktop/src/renderer/src/features/spending-summary/constants.ts apps/desktop/src/renderer/src/features/spending-summary/types.ts
git commit -m "feat(desktop): spending block — category icons, constants and view models"
```

---

### Task 8: pure helpers

**Files:**
- Rewrite: `apps/desktop/src/renderer/src/features/spending-summary/utils.ts`
- Test: `apps/desktop/tests/renderer/spending.test.ts`

- [ ] **Step 1: Write the failing tests** (`apps/desktop/tests/renderer/spending.test.ts`; texts read Russian):

```ts
// Pure helpers of the spending block. balanceApi is never called here: the participant slice pulls it in, so it is stubbed.
import { describe, expect, it, vi } from 'vitest';
import type { SpendingOverview } from '@contract/api.ts';
import {
  change,
  convertLines,
  opsView,
  parsePrefs,
  ringStops,
  rowsFor,
  shareOf,
  totalFor,
} from '@/features/spending-summary/utils.ts';

vi.mock('@/shared/api', () => ({ balanceApi: {} }));

const P = [
  { id: 1, name: 'Сергей', color: 'var(--series-blue)' },
  { id: 2, name: 'Аня', color: 'var(--series-orange)' },
];
const part = (participantId: number, net: number, purchases: number, prev: { net: number; purchases: number } | null) => ({ participantId, net, purchases, prev });
const cat = (category: string, categoryId: string | null, net: number, purchases: number, prevNet: number | null, people: ReturnType<typeof part>[] = []) =>
  ({ category, categoryId, net, purchases, prev: prevNet === null ? null : { net: prevNet, purchases: purchases - 1 }, people }) as SpendingOverview['categories'][number];

const VIEW: SpendingOverview = {
  month: '2026-09',
  period: { from: '2026-09-01', to: '2026-09-30', days: 30, incomplete: false, dataUntil: '2026-10-01', coveredDays: 30, pendingHolds: 0 },
  compare: { from: '2026-08-01', to: '2026-08-31', partial: false },
  total: { net: 100_000, purchases: 20, netPerDay: 3_333, prev: { net: 80_000, purchases: 18 } },
  people: [part(1, 60_000, 12, { net: 50_000, purchases: 10 }), part(2, 40_000, 8, { net: 30_000, purchases: 8 })],
  categories: [
    cat('продукты', 'groceries', 50_000, 10, 40_000, [part(1, 30_000, 6, { net: 25_000, purchases: 5 }), part(2, 20_000, 4, { net: 15_000, purchases: 4 })]),
    cat('кафе и рестораны', 'cafes', 30_000, 6, 30_000, [part(1, 30_000, 6, { net: 30_000, purchases: 5 }), part(2, 0, 0, { net: 0, purchases: 0 })]),
    cat('подарки', 'gifts', 20_000, 4, 0, [part(1, 0, 0, { net: 0, purchases: 0 }), part(2, 20_000, 4, { net: 0, purchases: 0 })]),
  ],
  fx: [{ currency: 840, rate: 41, prevRate: 40, nearest: false }, { currency: 978, rate: null, prevRate: null, nearest: false }],
  leftOut: [],
  familyTotal: null,
};
const PREFS = { split: true, mark: false, usd: false, eur: false };

describe('change', () => {
  it('more / less with the percent and the amount; under 3% → same; last month 0 → new; no comparison → null', () => {
    expect(change(110, 100)).toEqual({ kind: 'up', diff: 10, pct: 10 });
    expect(change(80, 100)).toEqual({ kind: 'down', diff: 20, pct: 20 });
    expect(change(102, 100)).toEqual({ kind: 'same', diff: 2, pct: 2 });
    expect(change(50, 0)).toEqual({ kind: 'new', diff: 50, pct: 0 });
    expect(change(50, null)).toBeNull();
  });
});

describe('opsView', () => {
  it('the count with its plural; the difference against last month', () => {
    expect(opsView(38, 36, '2026-09')).toMatchObject({ text: '38 операций', diff: '+2', tone: 'up', title: 'В августе — 36 операций' });
    expect(opsView(21, 24, '2026-09')).toMatchObject({ text: '21 операция', diff: '−3', tone: 'down' });
    expect(opsView(5, 5, '2026-09')).toMatchObject({ diff: 'столько же', tone: 'neutral' });
    expect(opsView(2, 0, '2026-09')).toMatchObject({ diff: 'новое' });
    expect(opsView(2, null, '2026-09')).toMatchObject({ diff: '', title: '' });
  });
});

describe('rowsFor', () => {
  it('the family: colours by rank, people segments, share of the total, change chips', () => {
    const rows = rowsFor(VIEW, null, P, PREFS);
    expect(rows.map((r) => [r.key, r.color, r.share])).toEqual([
      ['продукты', 'var(--category-1)', '50%'],
      ['кафе и рестораны', 'var(--category-2)', '30%'],
      ['подарки', 'var(--category-3)', '20%'],
    ]);
    expect(rows[0]!.segments.map((s) => [s.value, s.color])).toEqual([[30_000, 'var(--series-blue)'], [20_000, 'var(--series-orange)']]);
    expect(rows[0]!.chip).toMatchObject({ tone: 'up', arrow: 'up' });
    expect(rows[1]!.chip).toMatchObject({ tone: 'neutral', arrow: null, text: 'как в августе' });
    expect(rows[2]!.chip).toMatchObject({ text: 'новое' });
    expect(rows[0]!.people.map((p) => p.name)).toEqual(['Сергей', 'Аня']);
  });

  it('a picked person: their amounts, re-sorted, the others fade; categories without them drop out', () => {
    const rows = rowsFor(VIEW, 2, P, PREFS);
    expect(rows.map((r) => [r.key, r.amount])).toEqual([['продукты', '20 000 ₴'], ['подарки', '20 000 ₴']]);
    expect(rows[0]!.segments.map((s) => s.color)).toEqual(['color-mix(in oklch, var(--series-blue) 22%, var(--surface))', 'var(--series-orange)']);
    expect(rows[0]!.people.find((p) => p.participantId === 1)!.faded).toBe(true);
    // colours stay those of the family's rank
    expect(rows[1]!.color).toBe('var(--category-3)');
  });

  it('split off → one segment in the category colour; mark on → last month position', () => {
    const rows = rowsFor(VIEW, null, P, { ...PREFS, split: false, mark: true });
    expect(rows[0]!.segments).toEqual([{ value: 1, color: 'var(--category-1)', title: '' }]);
    expect(rows[0]!.mark).toBe(80);
    expect(rows[2]!.mark).toBeNull(); // nothing last month
  });

  it('more than seven categories → the top seven and «Остальное · N»', () => {
    const many = { ...VIEW, categories: Array.from({ length: 9 }, (_, i) => cat(`c${i}`, null, 1_000 * (9 - i), 1, null)) };
    const rows = rowsFor(many, null, P, PREFS);
    expect(rows).toHaveLength(8);
    expect(rows[7]).toMatchObject({ key: 'rest', name: 'Остальное · 2', color: 'var(--border-strong)', amount: '30 ₴' });
  });
});

describe('totalFor / shareOf / ringStops / convertLines', () => {
  it('the family or a person', () => {
    expect(totalFor(VIEW, null)).toEqual({ net: 100_000, purchases: 20, prev: { net: 80_000, purchases: 18 } });
    expect(totalFor(VIEW, 2)).toEqual({ net: 40_000, purchases: 8, prev: { net: 30_000, purchases: 8 } });
  });
  it('share in whole percent', () => {
    expect(shareOf(1, 3)).toBe('33%');
    expect(shareOf(1, 0)).toBe('0%');
  });
  it('ring stops: each part with a gap', () => {
    expect(ringStops([{ value: 1, color: 'a' }, { value: 1, color: 'b' }])).toBe(
      'conic-gradient(a 0.00deg 178.60deg, var(--surface) 178.60deg 180.00deg, b 180.00deg 358.60deg, var(--surface) 358.60deg 360.00deg)',
    );
    expect(ringStops([])).toBe('conic-gradient(var(--surface-sunken) 0deg 360deg)');
  });
  it('currency lines for the switched-on currencies with a rate', () => {
    expect(convertLines(41_000, VIEW.fx, { ...PREFS, usd: true, eur: true })).toEqual(['≈ 10 $']);
    expect(convertLines(41_000, VIEW.fx, PREFS)).toEqual([]);
  });
});

describe('parsePrefs', () => {
  it('defaults for nothing or garbage; each field on its own', () => {
    expect(parsePrefs(null)).toEqual({ split: true, mark: false, usd: false, eur: false });
    expect(parsePrefs('{oops')).toEqual({ split: true, mark: false, usd: false, eur: false });
    expect(parsePrefs('{"mark":true,"usd":"yes","split":false}')).toEqual({ split: false, mark: true, usd: false, eur: false });
  });
});
```

`formatMoney` uses `uk-UA` grouping with a narrow no-break space; if the expectations above (`'20 000 ₴'`) fail on the
space character only, write them with `formatMoney(2_000_000 … )` from `@/shared/lib` instead of literals.

Run: `pnpm --filter @mono/desktop exec vitest run tests/renderer/spending.test.ts`
Expected: FAIL — the helpers do not exist.

- [ ] **Step 2: Implement** — replace `features/spending-summary/utils.ts`:

```ts
import type { SpendingAmounts, SpendingFx, SpendingOverview, SpendingPersonPart } from '@contract/api.ts';
import { formatMoney, monthShortName, shortDate, t } from '@/shared/lib';
import { CATEGORY_COLORS, CATEGORY_ICON, FX_CURRENCIES, SAME_SHARE, TOP } from './constants.ts';
import type { BarSegment, BlockPerson, ChipView, OpsView, PersonLineView, PersonRowView, RowView, SpendingPrefs } from './types.ts';

const UAH = 980;
const GREY = 'var(--border-strong)';
type MonthNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

export const money = (kopecks: number): string => formatMoney(kopecks, UAH);

/** The month before `month` ('YYYY-MM') as a number 1–12. */
function prevMonthNumber(month: string): MonthNumber {
  const m = Number(month.slice(5, 7));
  return (m === 1 ? 12 : m - 1) as MonthNumber;
}
const prevIn = (month: string) => t(`common.monthIn.${prevMonthNumber(month)}`);

/** Why the numbers may be partial or empty; null when the month is complete. */
export function periodNote(p: Readonly<SpendingOverview['period']>): string | null {
  if (p.dataUntil === null) return t('home.spending.noData');
  if (p.dataUntil < p.from) return t('home.spending.notYet', { date: shortDate(p.dataUntil) });
  if (!p.incomplete) return null;
  return t('home.spending.partial', { date: shortDate(p.dataUntil) });
}

/** A category the core no longer has comes as its bare word: shown capitalised. */
export function capitalize(s: string): string {
  return s.charAt(0).toLocaleUpperCase('uk') + s.slice(1);
}

export function categoryName(c: { category: string; categoryId: string | null }): string {
  return c.categoryId ? t(`home.spending.category.${c.categoryId as keyof typeof CATEGORY_ICON & string}`) : capitalize(c.category);
}

export type Change = { kind: 'up' | 'down' | 'same' | 'new'; diff: number; pct: number };

/** null — no comparison. */
export function change(now: number, prev: number | null): Change | null {
  if (prev === null) return null;
  if (prev === 0) return now > 0 ? { kind: 'new', diff: now, pct: 0 } : { kind: 'same', diff: 0, pct: 0 };
  const diff = Math.abs(now - prev);
  const pct = Math.round((diff / prev) * 100);
  if (diff < prev * SAME_SHARE) return { kind: 'same', diff, pct };
  return { kind: now > prev ? 'up' : 'down', diff, pct };
}

const tone = (c: Change) => (c.kind === 'up' ? 'up' : c.kind === 'down' ? 'down' : 'neutral');
const arrow = (c: Change) => (c.kind === 'up' ? 'up' : c.kind === 'down' ? 'down' : null);

/** The chip of a row or a person: the amount difference («▲ 1 090 ₴»), «как в августе», «новое». */
export function amountChip(now: number, prev: number | null, month: string): ChipView | null {
  const c = change(now, prev);
  if (!c) return null;
  const text = c.kind === 'new' ? t('home.spending.change.new') : c.kind === 'same' ? t('home.spending.change.same', { month: prevIn(month) }) : money(c.diff);
  return { text, tone: tone(c), arrow: arrow(c) };
}

/** The chip under the ring: «на 14% больше, чем в августе» (… «к этому дню» while the month is in progress). */
export function centerChip(now: number, prev: number | null, month: string, partial: boolean): ChipView | null {
  const c = change(now, prev);
  if (!c) return null;
  const m = prevIn(month);
  if (c.kind === 'same' || c.kind === 'new') return { text: t('home.spending.change.same', { month: m }), tone: 'neutral', arrow: null };
  const key = c.kind === 'up' ? (partial ? 'home.spending.change.morePartial' : 'home.spending.change.more') : partial ? 'home.spending.change.lessPartial' : 'home.spending.change.less';
  return { text: t(key, { pct: c.pct, month: m }), tone: tone(c), arrow: arrow(c) };
}

/** The short chip of the people list: «+9%». */
export function pctChip(now: number, prev: number | null, month: string): ChipView | null {
  const c = change(now, prev);
  if (!c) return null;
  if (c.kind === 'same' || c.kind === 'new') return { text: c.kind === 'new' ? t('home.spending.change.new') : t('home.spending.change.same', { month: prevIn(month) }), tone: 'neutral', arrow: null };
  return { text: `${c.kind === 'up' ? '+' : '−'}${c.pct}%`, tone: tone(c), arrow: null };
}

export function opsView(now: number, prev: number | null, month: string): OpsView {
  const text = t('home.spending.ops', now);
  if (prev === null) return { text, diff: '', tone: 'neutral', title: '' };
  const title = prev ? t('home.spending.opsPrev', { month: prevIn(month), ops: t('home.spending.ops', prev) }) : '';
  if (prev === 0) return { text, diff: now > 0 ? t('home.spending.change.new') : '', tone: 'neutral', title };
  const d = now - prev;
  if (d === 0) return { text, diff: t('home.spending.opsSame'), tone: 'neutral', title };
  return { text, diff: `${d > 0 ? '+' : '−'}${Math.abs(d)}`, tone: d > 0 ? 'up' : 'down', title };
}

/** «+4 к авг.» under the ring. */
export function opsVs(now: number, prev: number | null, month: string): string {
  const v = opsView(now, prev, month);
  if (!v.diff || v.tone === 'neutral') return v.diff;
  return t('home.spending.opsVs', { diff: v.diff, month: monthShortName(prevMonthNumber(month)) });
}

export function shareOf(part: number, whole: number): string {
  return `${whole > 0 ? Math.round((part / whole) * 100) : 0}%`;
}

/** The ring: each part with a small gap; nothing → a plain sunken ring. */
export function ringStops(parts: ReadonlyArray<{ value: number; color: string }>): string {
  const sum = parts.reduce((s, p) => s + p.value, 0);
  if (sum <= 0) return 'conic-gradient(var(--surface-sunken) 0deg 360deg)';
  const gap = parts.length > 1 ? 1.4 : 0;
  let deg = 0;
  const stops: string[] = [];
  for (const p of parts) {
    const d = (p.value / sum) * 360;
    stops.push(`${p.color} ${deg.toFixed(2)}deg ${(deg + d - gap).toFixed(2)}deg`);
    if (gap) stops.push(`var(--surface) ${(deg + d - gap).toFixed(2)}deg ${(deg + d).toFixed(2)}deg`);
    deg += d;
  }
  return `conic-gradient(${stops.join(', ')})`;
}

/** «≈ 359 $» for each switched-on currency that has a rate this month. */
export function convertLines(kopecks: number, fx: ReadonlyArray<SpendingFx>, prefs: Readonly<SpendingPrefs>): string[] {
  return FX_CURRENCIES.filter((c) => prefs[c.key])
    .map((c) => fx.find((f) => f.currency === c.currency))
    .filter((f): f is SpendingFx & { rate: number } => !!f && f.rate !== null)
    .map((f) => `≈ ${formatMoney(Math.round(kopecks / f.rate), f.currency)}`);
}

/** Under the ring: the amount in each currency and its own change (this month's rate vs last month's). */
export function centerConv(now: number, prev: number | null, view: Readonly<SpendingOverview>, prefs: Readonly<SpendingPrefs>): Array<{ text: string; chip: ChipView | null; title: string }> {
  return FX_CURRENCIES.filter((c) => prefs[c.key])
    .map((c) => view.fx.find((f) => f.currency === c.currency))
    .filter((f): f is SpendingFx & { rate: number } => !!f && f.rate !== null)
    .map((f) => {
      const a = Math.round(now / f.rate);
      const p = prev !== null && f.prevRate !== null ? Math.round(prev / f.prevRate) : null;
      return {
        text: `≈ ${formatMoney(a, f.currency)}`,
        chip: pctChip(a, p, view.month),
        title: p === null ? '' : t('home.spending.inCurrencyTitle', { month: prevIn(view.month), amount: formatMoney(p, f.currency), prevRate: (f.prevRate ?? 0).toFixed(2).replace('.', ','), rate: f.rate.toFixed(2).replace('.', ',') }),
      };
    });
}

/** The family or the picked person. */
export function totalFor(view: Readonly<SpendingOverview>, pick: number | null): SpendingAmounts & { prev: SpendingAmounts | null } {
  if (pick === null) return { net: view.total.net, purchases: view.total.purchases, prev: view.total.prev };
  const p = view.people.find((x) => x.participantId === pick);
  return p ? { net: p.net, purchases: p.purchases, prev: p.prev } : { net: 0, purchases: 0, prev: view.total.prev ? { net: 0, purchases: 0 } : null };
}

const fade = (color: string) => `color-mix(in oklch, ${color} 22%, var(--surface))`;
const initial = (name: string) => name.slice(0, 1).toLocaleUpperCase('uk');
const personOf = (people: ReadonlyArray<BlockPerson>, id: number): BlockPerson => people.find((p) => p.id === id) ?? { id, name: '?', color: GREY };

type Line = { key: string; name: string; icon: string; color: string; net: number; purchases: number; prev: SpendingAmounts | null; parts: SpendingPersonPart[] };

function sumParts(lists: ReadonlyArray<ReadonlyArray<SpendingPersonPart>>): SpendingPersonPart[] {
  const first = lists[0] ?? [];
  return first.map((p0, i) => {
    let net = 0, purchases = 0, pn = 0, pp = 0, hasPrev = true;
    for (const l of lists) {
      const p = l[i];
      if (!p) continue;
      net += p.net; purchases += p.purchases;
      if (p.prev) (pn += p.prev.net), (pp += p.prev.purchases);
      else hasPrev = false;
    }
    return { participantId: p0.participantId, net, purchases, prev: hasPrev ? { net: pn, purchases: pp } : null };
  });
}

/** The rows of the list for the family (pick null) or one picked person; colours stay those of the family's rank. */
export function rowsFor(view: Readonly<SpendingOverview>, pick: number | null, people: ReadonlyArray<BlockPerson>, prefs: Readonly<SpendingPrefs>): RowView[] {
  const color = new Map(view.categories.map((c, i) => [c.category, CATEGORY_COLORS[i] ?? GREY]));
  const lines: Line[] = view.categories
    .map((c) => {
      const own = pick === null ? c : c.people.find((p) => p.participantId === pick);
      return {
        key: c.category,
        name: categoryName(c),
        icon: CATEGORY_ICON[(c.categoryId ?? 'other') as keyof typeof CATEGORY_ICON],
        color: color.get(c.category) ?? GREY,
        net: own?.net ?? 0,
        purchases: own?.purchases ?? 0,
        prev: own ? own.prev : null,
        parts: c.people,
      };
    })
    .filter((l) => l.net > 0)
    .sort((a, b) => b.net - a.net);

  const top = lines.slice(0, TOP);
  const rest = lines.slice(TOP);
  if (rest.length > 0) {
    const prevs = rest.map((l) => l.prev);
    top.push({
      key: 'rest',
      name: t('home.spending.rest', { n: rest.length }),
      icon: CATEGORY_ICON.rest,
      color: GREY,
      net: rest.reduce((s, l) => s + l.net, 0),
      purchases: rest.reduce((s, l) => s + l.purchases, 0),
      prev: prevs.every((p) => p !== null) ? { net: prevs.reduce((s, p) => s + (p?.net ?? 0), 0), purchases: prevs.reduce((s, p) => s + (p?.purchases ?? 0), 0) } : null,
      parts: sumParts(rest.map((l) => l.parts)),
    });
  }

  const total = totalFor(view, pick).net;
  const max = Math.max(1, ...top.map((l) => Math.max(l.net, l.prev?.net ?? 0)));
  return top.map((l) => {
    const segments: BarSegment[] =
      prefs.split && l.parts.length > 0
        ? l.parts.filter((p) => p.net > 0).map((p) => {
            const who = personOf(people, p.participantId);
            return { value: p.net, color: pick === null || pick === p.participantId ? who.color : fade(who.color), title: `${who.name} — ${money(p.net)}` };
          })
        : [{ value: 1, color: pick === null ? l.color : personOf(people, pick).color, title: '' }];
    const pmax = Math.max(1, ...l.parts.map((p) => Math.max(p.net, p.prev?.net ?? 0)));
    return {
      key: l.key,
      name: l.name,
      icon: l.icon,
      color: l.color,
      share: shareOf(l.net, total),
      amount: money(l.net),
      conv: convertLines(l.net, view.fx, prefs),
      ops: opsView(l.purchases, l.prev?.purchases ?? null, view.month),
      chip: amountChip(l.net, l.prev?.net ?? null, view.month),
      width: Math.round((l.net / max) * 1000) / 10,
      mark: prefs.mark && l.prev && l.prev.net > 0 ? Math.round((l.prev.net / max) * 1000) / 10 : null,
      markTitle: l.prev ? t('home.spending.markTitle', { month: prevIn(view.month), amount: money(l.prev.net) }) : '',
      segments,
      people: l.parts
        .filter((p) => p.net > 0 || (p.prev?.net ?? 0) > 0)
        .map((p): PersonLineView => {
          const who = personOf(people, p.participantId);
          return {
            participantId: p.participantId,
            name: who.name,
            initial: initial(who.name),
            color: who.color,
            amount: money(p.net),
            conv: convertLines(p.net, view.fx, prefs),
            ops: { ...opsView(p.purchases, p.prev?.purchases ?? null, view.month), text: t('home.spending.opsShort', { n: p.purchases }) },
            chip: amountChip(p.net, p.prev?.net ?? null, view.month),
            width: Math.round((p.net / pmax) * 1000) / 10,
            mark: prefs.mark && p.prev && p.prev.net > 0 ? Math.round((p.prev.net / pmax) * 1000) / 10 : null,
            markTitle: p.prev ? t('home.spending.markTitle', { month: prevIn(view.month), amount: money(p.prev.net) }) : '',
            faded: pick !== null && pick !== p.participantId,
          };
        }),
    };
  });
}

/** The people list: «Вся семья» first, then each person. */
export function peopleRows(view: Readonly<SpendingOverview>, pick: number | null, people: ReadonlyArray<BlockPerson>): PersonRowView[] {
  const family: PersonRowView = {
    participantId: null,
    name: t('home.spending.whole'),
    initial: '',
    color: '',
    dots: people.map((p) => p.color),
    caption: t('home.spending.together', { ops: t('home.spending.opsShort', { n: view.total.purchases }) }),
    amount: money(view.total.net),
    chip: pctChip(view.total.net, view.total.prev?.net ?? null, view.month),
    pressed: pick === null,
  };
  return [
    family,
    ...view.people.map((p) => {
      const who = personOf(people, p.participantId);
      return {
        participantId: p.participantId,
        name: who.name,
        initial: initial(who.name),
        color: who.color,
        dots: [],
        caption: t('home.spending.personShare', { pct: shareOf(p.net, view.total.net).replace('%', ''), ops: t('home.spending.opsShort', { n: p.purchases }) }),
        amount: money(p.net),
        chip: pctChip(p.net, p.prev?.net ?? null, view.month),
        pressed: pick === p.participantId,
      };
    }),
  ];
}

/**
 * The ring of the rows: each named row its own net; «Other» gets the rest of the total, so a refund-only category
 * (counted in the total, absent from the rows) never makes the ring larger than the total.
 */
export function ringOf(rows: ReadonlyArray<RowView>, view: Readonly<SpendingOverview>, pick: number | null): string {
  const netOf = (key: string) => {
    const c = view.categories.find((x) => x.category === key);
    if (!c) return 0;
    return pick === null ? c.net : (c.people.find((p) => p.participantId === pick)?.net ?? 0);
  };
  const named = rows.filter((r) => r.key !== 'rest').map((r) => ({ value: netOf(r.key), color: r.color }));
  const rest = rows.find((r) => r.key === 'rest');
  const parts = rest ? [...named, { value: Math.max(0, totalFor(view, pick).net - named.reduce((s, p) => s + p.value, 0)), color: rest.color }] : named;
  return ringStops(parts);
}

/** «В августе» — the stats line under the ring. */
export function prevInText(month: string): string {
  return t('home.spending.inMonth', { month: prevIn(month) });
}

/** «Нет данных за август для сравнения». */
export function noCompareText(month: string): string {
  return t('home.spending.noCompare', { month: t(`common.month.${prevMonthNumber(month)}`).toLocaleLowerCase('uk') });
}

/** «+ 25 $ без курса — не в итогах» lines. */
export function leftOutLines(view: Readonly<SpendingOverview>): string[] {
  return view.leftOut.map((l) => t('home.spending.leftOut', { amount: formatMoney(l.net, l.currency) }));
}

/** The menu choices from storage: each field on its own, defaults for anything else. */
export function parsePrefs(raw: string | null): SpendingPrefs {
  const d: SpendingPrefs = { split: true, mark: false, usd: false, eur: false };
  if (raw === null) return d;
  let v: unknown;
  try {
    v = JSON.parse(raw);
  } catch {
    return d;
  }
  if (typeof v !== 'object' || v === null) return d;
  const pick = (k: keyof SpendingPrefs) => {
    const x: unknown = (v as Record<string, unknown>)[k];
    return typeof x === 'boolean' ? x : d[k];
  };
  return { split: pick('split'), mark: pick('mark'), usd: pick('usd'), eur: pick('eur') };
}
```

Notes for the implementer:
- Add a test for `ringOf` next to `ringStops`:

```ts
  it('ringOf: the rows own nets in their colours', () => {
    expect(ringOf(rowsFor(VIEW, null, P, PREFS), VIEW, null)).toBe(
      ringStops([{ value: 50_000, color: 'var(--category-1)' }, { value: 30_000, color: 'var(--category-2)' }, { value: 20_000, color: 'var(--category-3)' }]),
    );
  });
```

  (import `ringOf` with the other helpers).
- `as Record<string, unknown>` in `parsePrefs` reads a JSON object after the `typeof … === 'object'` guard — the one
  `as` of the slice; keep the comment above the function.
- `categoryName`'s key: use the `MessageKey`-typed template (`` `home.spending.category.${CategoryId}` ``) if the
  dictionary type rejects the cast; the old `utils.ts` did `t(\`home.spending.category.${line.categoryId}\`)` with
  `categoryId: CategoryId` — keep that form.

- [ ] **Step 3: Run the tests**

Run: `pnpm --filter @mono/desktop exec vitest run tests/renderer/spending.test.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/renderer/src/features/spending-summary/utils.ts apps/desktop/tests/renderer/spending.test.ts
git commit -m "feat(desktop): spending block helpers — rows for a pick, change chips, operations, ring, currency lines"
```

---

### Task 9: prefs store, request and composable

**Files:**
- Create: `apps/desktop/src/renderer/src/features/spending-summary/store/useSpendingPrefsStore.ts`
- Rewrite: `.../spending-summary/api/useSpendingRequest.ts`, `.../spending-summary/composables/useSpending.ts`
- Test: `apps/desktop/tests/renderer/spending.test.ts` (prefs store)

- [ ] **Step 1: Write the failing store test** — append to `tests/renderer/spending.test.ts`:

```ts
describe('useSpendingPrefsStore', () => {
  it('reads defaults, writes each change, survives a storage that throws', async () => {
    const { createPinia, setActivePinia } = await import('pinia');
    const mem = new Map<string, string>();
    vi.stubGlobal('localStorage', { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) });
    setActivePinia(createPinia());
    const { useSpendingPrefsStore } = await import('@/features/spending-summary/store/useSpendingPrefsStore.ts');
    const s = useSpendingPrefsStore();
    expect(s.prefs).toEqual({ split: true, mark: false, usd: false, eur: false });
    s.set('usd', true);
    expect(JSON.parse(mem.get('spending.view')!)).toEqual({ split: true, mark: false, usd: true, eur: false });

    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); } });
    setActivePinia(createPinia());
    const s2 = useSpendingPrefsStore();
    expect(s2.prefs.split).toBe(true);
    expect(() => s2.set('mark', true)).not.toThrow();
    expect(s2.prefs.mark).toBe(true);
    vi.unstubAllGlobals();
  });
});
```

Run: `pnpm --filter @mono/desktop exec vitest run tests/renderer/spending.test.ts -t useSpendingPrefsStore`
Expected: FAIL — module not found.

- [ ] **Step 2: The store**

```ts
import { defineStore } from 'pinia';
import { ref } from 'vue';
import { PREFS_KEY } from '../constants.ts';
import type { SpendingPrefs } from '../types.ts';
import { parsePrefs } from '../utils.ts';

function read(): SpendingPrefs {
  try {
    return parsePrefs(localStorage.getItem(PREFS_KEY));
  } catch {
    return parsePrefs(null);
  }
}

/** The block's menu choices, remembered on this computer (a convenience: defaults when storage is unavailable). */
export const useSpendingPrefsStore = defineStore('spending-prefs', () => {
  const prefs = ref<SpendingPrefs>(read());

  function set<K extends keyof SpendingPrefs>(key: K, value: SpendingPrefs[K]): void {
    prefs.value = { ...prefs.value, [key]: value };
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(prefs.value));
    } catch {
      // Storage unavailable: the choice holds until the app restarts.
    }
  }

  return { prefs, set };
});
```

- [ ] **Step 3: The request**

```ts
import type { SpendingOverview, SpendingOverviewQuery } from '@contract/api.ts';
import { balanceApi } from '@/shared/api';

export function useSpendingRequest(): { fetchSpendingOverview: (q: SpendingOverviewQuery) => Promise<SpendingOverview> } {
  return { fetchSpendingOverview: (q) => balanceApi.getSpendingOverview(q) };
}
```

- [ ] **Step 4: The composable**

```ts
import { computed, ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import type { Scope } from '@contract/api.ts';
import { useImportProgressStore } from '@/entities/import-progress';
import { useMonthStore } from '@/entities/period';
import { colorVar, useParticipantStore } from '@/entities/participant';
import { useSyncStatusStore } from '@/entities/sync-status';
import { useAsyncData } from '@/shared/lib';
import { useSpendingRequest } from '../api/useSpendingRequest.ts';
import type { BlockPerson, UseSpendingReturn } from '../types.ts';
import { periodNote } from '../utils.ts';

/**
 * The spending block of one Kyiv month, scope and participant (or the whole family): reloads when any changes, and
 * quietly when the data changes. The block's own person pick and expanded category reset with them.
 */
export function useSpending(): UseSpendingReturn {
  const { fetchSpendingOverview } = useSpendingRequest();
  const syncStatus = useSyncStatusStore();
  const importProgress = useImportProgressStore();
  const participant = useParticipantStore();
  const { month } = storeToRefs(useMonthStore());
  const scope = ref<Scope>('personal');
  const pick = ref<number | null>(null);
  const open = ref<string | null>(null);

  const participantId = () => participant.selectedId;
  const { state } = useAsyncData(
    () => {
      const id = participantId();
      return fetchSpendingOverview({ month: month.value, scope: scope.value, ...(id !== null ? { participantId: id } : {}) });
    },
    [month, scope, participantId],
    { quiet: [() => syncStatus.version] },
  );
  watch([month, scope, participantId], () => {
    pick.value = null;
    open.value = null;
  });

  const view = computed(() => state.value.data);
  const family = computed(() => participant.multiple && participant.selectedId === null);
  const member = computed(() => participant.multiple && participant.selectedId !== null);
  const people = computed<ReadonlyArray<BlockPerson>>(() => participant.people.map((p) => ({ id: p.id, name: p.label, color: colorVar(p.color) })));
  const selected = computed<BlockPerson | null>(() => people.value.find((p) => p.id === participant.selectedId) ?? null);

  return {
    month,
    scope,
    state,
    view,
    periodNote: computed(() => (view.value ? periodNote(view.value.period) : null)),
    importing: computed(() => importProgress.running && !importProgress.auto),
    family,
    member,
    people,
    selected,
    pick,
    open,
  };
}
```

- [ ] **Step 5: Run the tests**

Run: `pnpm --filter @mono/desktop exec vitest run tests/renderer/spending.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/desktop/src/renderer/src/features/spending-summary apps/desktop/tests/renderer/spending.test.ts
git commit -m "feat(desktop): spending block — remembered menu choices, the overview request, pick and expansion"
```

---

### Task 10: components and the feature

**Files (all under `apps/desktop/src/renderer/src/features/spending-summary/`):**
- Create: `components/ChangeChip.vue`, `components/SpendingSettings.vue`, `components/SpendingHeader.vue`,
  `components/CategoryRing.vue`, `components/PeopleList.vue`, `components/CategoryRow.vue`
- Rewrite: `SpendingFeature.vue`

Components only display (FSD rule): props in, events out; texts through `$t`; dynamic colours and widths through CSS
variables (`:style="{ '--w': … }"` + Tailwind `w-(--w)`), never inline style values.

- [ ] **Step 1: `ChangeChip.vue`**

```vue
<script setup lang="ts">
import { VIcon } from '@/shared/ui';
import type { ChipView } from '../types.ts';

const { chip, size = 'md' } = defineProps<{ chip: ChipView; size?: 'sm' | 'md' }>();
const TONE = {
  up: 'bg-[color-mix(in_oklch,var(--series-orange)_16%,var(--surface))] text-[color-mix(in_oklch,var(--series-orange)_72%,var(--foreground))]',
  down: 'bg-[color-mix(in_oklch,var(--series-blue)_16%,var(--surface))] text-[color-mix(in_oklch,var(--series-blue)_72%,var(--foreground))]',
  neutral: 'bg-surface-sunken text-foreground-secondary',
} as const;
</script>

<template>
  <span
    class="inline-flex items-center gap-1 whitespace-nowrap rounded-full font-bold tabular-nums"
    :class="[TONE[chip.tone], size === 'sm' ? 'h-5.5 px-2 text-xs' : 'h-6 px-2.5 text-xs']"
    :title="chip.title"
  >
    <VIcon v-if="chip.arrow" :icon="chip.arrow === 'up' ? 'lucide:arrow-up-right' : 'lucide:arrow-down-right'" class="size-3" />
    {{ chip.text }}
  </span>
</template>
```

- [ ] **Step 2: `SpendingSettings.vue`** — the gear menu

```vue
<script setup lang="ts">
import { useId } from 'vue';
import type { SpendingFx } from '@contract/api.ts';
import { currencySymbol } from '@/shared/lib';
import { VPopover, VSwitch } from '@/shared/ui';
import { FX_CURRENCIES } from '../constants.ts';
import type { SpendingPrefs } from '../types.ts';

const { prefs, family, fx } = defineProps<{ prefs: Readonly<SpendingPrefs>; family: boolean; fx: ReadonlyArray<SpendingFx> }>();
const emit = defineEmits<{ set: [key: keyof SpendingPrefs, value: boolean] }>();
const id = useId();
const hasRate = (c: number) => fx.some((f) => f.currency === c && f.rate !== null);
</script>

<template>
  <VPopover icon="lucide:settings" :label="$t('home.spending.settings.button')">
    <div class="flex flex-col">
      <p class="px-2 pt-2 pb-1 text-xs font-semibold text-foreground-muted">{{ $t('home.spending.settings.bars') }}</p>
      <label v-if="family" :for="`${id}-split`" class="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2.5">
        <span class="flex grow flex-col gap-0.5">
          <span class="font-semibold">{{ $t('home.spending.settings.split') }}</span>
          <span class="text-xs text-foreground-muted">{{ $t('home.spending.settings.splitHint') }}</span>
        </span>
        <VSwitch :id="`${id}-split`" :model-value="prefs.split" @update:model-value="emit('set', 'split', $event)" />
      </label>
      <label :for="`${id}-mark`" class="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2.5">
        <span class="flex grow flex-col gap-0.5">
          <span class="font-semibold">{{ $t('home.spending.settings.mark') }}</span>
          <span class="text-xs text-foreground-muted">{{ $t('home.spending.settings.markHint') }}</span>
        </span>
        <VSwitch :id="`${id}-mark`" :model-value="prefs.mark" @update:model-value="emit('set', 'mark', $event)" />
      </label>
      <div class="mx-2 my-1 h-px bg-border-subtle" />
      <p class="px-2 pt-2 text-xs font-semibold text-foreground-muted">{{ $t('home.spending.settings.currency') }}</p>
      <p class="px-2 pb-1 text-xs text-foreground-muted">{{ $t('home.spending.settings.currencyNote') }}</p>
      <label v-for="c in FX_CURRENCIES" :key="c.key" :for="`${id}-${c.key}`" class="flex items-center gap-3 rounded-lg px-2 py-2.5" :class="hasRate(c.currency) ? 'cursor-pointer' : 'opacity-60'">
        <span class="flex grow flex-col gap-0.5">
          <span class="font-semibold">{{ $t(c.label) }}</span>
          <span class="text-xs text-foreground-muted">
            {{ hasRate(c.currency) ? $t('home.spending.settings.rateHint') : $t('home.spending.settings.noRate', { symbol: currencySymbol(c.currency) }) }}
          </span>
        </span>
        <VSwitch :id="`${id}-${c.key}`" :model-value="prefs[c.key] && hasRate(c.currency)" :disabled="!hasRate(c.currency)" @update:model-value="emit('set', c.key, $event)" />
      </label>
    </div>
  </VPopover>
</template>
```

(Check `VSwitch`'s `id` prop renders on its input, so the `<label for>` names it — `VSwitch` takes `id`.)

- [ ] **Step 3: `SpendingHeader.vue`**

```vue
<script setup lang="ts">
import { computed } from 'vue';
import type { Scope, SpendingFx } from '@contract/api.ts';
import { t } from '@/shared/lib';
import { VSegmentedControl } from '@/shared/ui';
import { SCOPES } from '../constants.ts';
import type { SpendingPrefs } from '../types.ts';
import SpendingSettings from './SpendingSettings.vue';

const { subtitle, prefs, family, fx } = defineProps<{ subtitle: string; prefs: Readonly<SpendingPrefs>; family: boolean; fx: ReadonlyArray<SpendingFx> }>();
const scope = defineModel<Scope>('scope', { required: true });
const emit = defineEmits<{ set: [key: keyof SpendingPrefs, value: boolean] }>();
const scopes = computed(() => SCOPES.map((s) => ({ ...s, label: t(s.label) })));
</script>

<template>
  <div class="relative z-10 flex flex-wrap items-center justify-between gap-3">
    <div class="flex items-baseline gap-2.5">
      <h3 class="m-0 text-[15px] font-bold">{{ $t('home.spending.title') }}</h3>
      <span class="text-sm text-foreground-muted first-letter:uppercase">{{ subtitle }}</span>
    </div>
    <div class="flex items-center gap-2">
      <VSegmentedControl v-model="scope" :options="scopes" />
      <SpendingSettings :prefs :family :fx @set="(k, v) => emit('set', k, v)" />
    </div>
  </div>
</template>
```

- [ ] **Step 4: `CategoryRing.vue`**

```vue
<script setup lang="ts">
import type { ChipView } from '../types.ts';
import ChangeChip from './ChangeChip.vue';

const { stops, label, amount, perDay, chip, conv } = defineProps<{
  stops: string;
  label: string;
  amount: string;
  perDay: string | null;
  chip: ChipView | null;
  conv: ReadonlyArray<{ text: string; chip: ChipView | null; title: string }>;
}>();
</script>

<template>
  <div class="flex flex-col items-center gap-3">
    <div class="relative size-52.5 rounded-full bg-(image:--ring)" :style="{ '--ring': stops }" aria-hidden="true">
      <div class="absolute inset-[27px] flex flex-col items-center justify-center gap-0.5 rounded-full bg-surface text-center">
        <span class="text-xs text-foreground-muted">{{ label }}</span>
        <span class="text-2xl font-bold tabular-nums">{{ amount }}</span>
        <span v-if="perDay" class="text-xs text-foreground-muted">{{ perDay }}</span>
        <span v-for="c in conv" :key="c.text" class="whitespace-nowrap text-[11px] text-foreground-secondary tabular-nums" :title="c.title">
          {{ c.text }}
          <span v-if="c.chip" class="font-bold">{{ c.chip.text }}</span>
        </span>
      </div>
    </div>
    <ChangeChip v-if="chip" :chip />
  </div>
</template>
```

The ring is `aria-hidden`: the amount and the category list carry the same information as text. Because the visible
amount inside is then hidden too, the feature repeats it in an `sr-only` line (Step 7).

- [ ] **Step 5: `PeopleList.vue`**

```vue
<script setup lang="ts">
import type { PersonRowView } from '../types.ts';
import ChangeChip from './ChangeChip.vue';

const { rows } = defineProps<{ rows: ReadonlyArray<PersonRowView> }>();
const emit = defineEmits<{ pick: [participantId: number | null] }>();
</script>

<template>
  <div class="flex flex-col gap-0.5">
    <button
      v-for="r in rows"
      :key="r.participantId ?? 'family'"
      type="button"
      :aria-pressed="r.pressed"
      class="flex h-11 items-center gap-2.5 rounded-xl px-2 text-left"
      :class="r.pressed ? 'bg-surface-raised ring-[1.5px] ring-(--c)' : 'hover:bg-surface-hover'"
      :style="{ '--c': r.participantId === null ? 'var(--border-strong)' : r.color }"
      @click="emit('pick', r.participantId)"
    >
      <span v-if="r.participantId === null" class="flex w-7 shrink-0 ps-1" aria-hidden="true">
        <span v-for="(d, i) in r.dots" :key="i" class="-ms-1 size-3 rounded-full bg-(--d) ring-2 ring-surface" :style="{ '--d': d }" />
      </span>
      <span v-else class="grid size-7 shrink-0 place-items-center rounded-full bg-(--c) text-[13px] font-extrabold text-white" aria-hidden="true">{{ r.initial }}</span>
      <span class="flex min-w-0 grow flex-col">
        <span class="truncate font-semibold">{{ r.name }}</span>
        <span class="truncate text-xs text-foreground-muted">{{ r.caption }}</span>
      </span>
      <span class="flex shrink-0 flex-col items-end gap-0.5">
        <span class="whitespace-nowrap font-bold tabular-nums">{{ r.amount }}</span>
        <ChangeChip v-if="r.chip" :chip="r.chip" size="sm" />
      </span>
    </button>
  </div>
</template>
```

- [ ] **Step 6: `CategoryRow.vue`**

```vue
<script setup lang="ts">
import { VIcon } from '@/shared/ui';
import type { RowView } from '../types.ts';
import ChangeChip from './ChangeChip.vue';

const { row, expandable, open } = defineProps<{ row: RowView; expandable: boolean; open: boolean }>();
const emit = defineEmits<{ toggle: [] }>();
const OPS_TONE = { up: 'text-[color-mix(in_oklch,var(--series-orange)_72%,var(--foreground))]', down: 'text-[color-mix(in_oklch,var(--series-blue)_72%,var(--foreground))]', neutral: 'text-foreground-muted' } as const;
</script>

<template>
  <div class="flex flex-col rounded-xl" :class="{ 'bg-surface-raised': open }">
    <component
      :is="expandable ? 'button' : 'div'"
      :type="expandable ? 'button' : undefined"
      :aria-expanded="expandable ? open : undefined"
      class="flex h-12 items-center gap-3 rounded-xl px-2.5 text-left"
      :class="{ 'cursor-pointer hover:bg-surface-hover': expandable }"
      @click="expandable && emit('toggle')"
    >
      <VIcon :icon="row.icon" class="size-4 shrink-0 text-(--cat)" :style="{ '--cat': row.color }" />
      <span class="flex min-w-0 grow flex-col gap-1.5">
        <span class="flex min-w-0 items-baseline justify-between gap-2.5">
          <span class="min-w-0 truncate font-semibold" :title="row.name">{{ row.name }}</span>
          <span class="inline-flex shrink-0 items-baseline gap-1.5 whitespace-nowrap text-xs tabular-nums">
            <span class="text-foreground-muted">{{ row.ops.text }}</span>
            <span v-if="row.ops.diff" class="font-bold" :class="OPS_TONE[row.ops.tone]" :title="row.ops.title">{{ row.ops.diff }}</span>
          </span>
        </span>
        <span class="flex items-center gap-2.5">
          <span class="relative block h-1 grow">
            <span class="absolute inset-y-0 left-0 flex w-(--w) gap-0.5" :style="{ '--w': `${row.width}%` }">
              <span v-for="(s, i) in row.segments" :key="i" class="block grow-(--g) basis-0 rounded-sm bg-(--s)" :style="{ '--g': s.value, '--s': s.color }" :title="s.title" />
            </span>
            <span v-if="row.mark !== null" class="absolute -top-1 left-(--m) -ms-px h-3 w-0.5 rounded-sm bg-foreground" :style="{ '--m': `${row.mark}%` }" :title="row.markTitle" />
          </span>
          <span class="w-8 shrink-0 text-right text-[11px] text-foreground-muted tabular-nums">{{ row.share }}</span>
        </span>
      </span>
      <span class="flex w-25 shrink-0 flex-col items-end gap-px">
        <span class="whitespace-nowrap font-bold tabular-nums">{{ row.amount }}</span>
        <span v-for="c in row.conv" :key="c" class="whitespace-nowrap text-[11px] text-foreground-muted tabular-nums">{{ c }}</span>
      </span>
      <span class="flex w-22.5 shrink-0 justify-end"><ChangeChip v-if="row.chip" :chip="row.chip" size="sm" /></span>
      <VIcon v-if="expandable" icon="lucide:chevron-right" class="size-3.5 shrink-0 text-foreground-muted transition-transform motion-reduce:transition-none" :class="{ 'rotate-90': open }" />
    </component>
    <div v-if="expandable && open" class="flex flex-col gap-0.5 pe-2.5 pb-2.5 ps-9">
      <div v-for="p in row.people" :key="p.participantId" class="flex min-h-7.5 items-center gap-2 py-0.5" :class="{ 'opacity-45': p.faded }">
        <span class="grid size-5.5 shrink-0 place-items-center rounded-full bg-(--c) text-[11px] font-extrabold text-white" :style="{ '--c': p.color }" aria-hidden="true">{{ p.initial }}</span>
        <span class="w-13 shrink-0 truncate text-xs text-foreground-secondary">{{ p.name }}</span>
        <span class="relative h-2 min-w-12 grow rounded-full bg-surface-sunken">
          <span class="absolute inset-y-0 left-0 w-(--w) rounded-full bg-(--c)" :style="{ '--w': `${p.width}%`, '--c': p.color }" />
          <span v-if="p.mark !== null" class="absolute -top-1 left-(--m) -ms-px h-4 w-0.5 rounded-sm bg-foreground" :style="{ '--m': `${p.mark}%` }" :title="p.markTitle" />
        </span>
        <span class="w-18 shrink-0 whitespace-nowrap text-right text-xs text-foreground-muted tabular-nums" :title="p.ops.title">
          {{ p.ops.text }} <span v-if="p.ops.diff" class="font-bold" :class="OPS_TONE[p.ops.tone]">{{ p.ops.diff }}</span>
        </span>
        <span class="flex w-22 shrink-0 flex-col items-end gap-px">
          <span class="whitespace-nowrap font-bold tabular-nums">{{ p.amount }}</span>
          <span v-for="c in p.conv" :key="c" class="whitespace-nowrap text-[11px] text-foreground-muted tabular-nums">{{ c }}</span>
        </span>
        <span class="flex w-21 shrink-0 justify-end"><ChangeChip v-if="p.chip" :chip="p.chip" size="sm" /></span>
      </div>
    </div>
  </div>
</template>
```

Tailwind arbitrary values with CSS variables (`w-(--w)`, `bg-(--c)`, `grow-(--g)`, `left-(--m)`, `bg-(image:--ring)`)
are Tailwind v4 syntax, as the balance block uses (`w-(--w)`, `bg-(--c)`). If `grow-(--g)` is not supported by the
installed Tailwind, use `[flex-grow:var(--g)]`.

- [ ] **Step 7: `SpendingFeature.vue`**

```vue
<script setup lang="ts">
import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { monthName, t } from '@/shared/lib';
import { VCard, VInfoNotice } from '@/shared/ui';
import CategoryRing from './components/CategoryRing.vue';
import CategoryRow from './components/CategoryRow.vue';
import PeopleList from './components/PeopleList.vue';
import SpendingHeader from './components/SpendingHeader.vue';
import { useSpending } from './composables/useSpending.ts';
import { useSpendingPrefsStore } from './store/useSpendingPrefsStore.ts';
import {
  centerChip, centerConv, leftOutLines, money, noCompareText, opsVs, peopleRows, prevInText, ringOf, rowsFor, shareOf, totalFor,
} from './utils.ts';

const { month, scope, state, view, periodNote, importing, family, member, people, selected, pick, open } = useSpending();
const prefsStore = useSpendingPrefsStore();
const { prefs } = storeToRefs(prefsStore);

/** Family: «Вся семья» or the picked person; a family member in the global filter: their name; the only person: none. */
const who = computed(() => {
  if (family.value) return pick.value === null ? t('home.spending.whole') : (people.value.find((p) => p.id === pick.value)?.name ?? '');
  return member.value ? (selected.value?.name ?? '') : '';
});
const subtitle = computed(() => [monthName(Number(month.value.slice(5, 7))), who.value].filter(Boolean).join(' · '));
const rows = computed(() => (view.value ? rowsFor(view.value, family.value ? pick.value : null, people.value, prefs.value) : []));
const total = computed(() => (view.value ? totalFor(view.value, family.value ? pick.value : null) : null));
const ring = computed(() => (view.value ? ringOf(rows.value, view.value, family.value ? pick.value : null) : ''));
const chip = computed(() => (view.value && total.value ? centerChip(total.value.net, total.value.prev?.net ?? null, view.value.month, view.value.compare?.partial ?? false) : null));
const conv = computed(() => (view.value && total.value ? centerConv(total.value.net, total.value.prev?.net ?? null, view.value, prefs.value) : []));
const perDay = computed(() => {
  const v = view.value;
  if (!v || !total.value || v.period.coveredDays === 0) return null;
  return t('home.spending.perDay', { amount: money(Math.round(total.value.net / v.period.coveredDays)) });
});
const whoRows = computed(() => (view.value && family.value ? peopleRows(view.value, pick.value, people.value) : []));
function onPick(id: number | null): void {
  pick.value = id;
}
function onToggle(key: string): void {
  open.value = open.value === key ? null : key;
}
</script>

<template>
  <VCard padding="md">
    <div class="flex flex-col gap-4">
      <SpendingHeader v-model:scope="scope" :subtitle :prefs :family :fx="view?.fx ?? []" @set="prefsStore.set" />

      <VInfoNotice v-if="state.status === 'error'" :card="false" icon="lucide:circle-alert" tone="danger" :subtitle="$t('home.spending.failed')" />
      <VInfoNotice v-else-if="periodNote" :card="false" icon="lucide:info" tone="info" :subtitle="periodNote" />
      <p v-if="importing" class="text-sm text-foreground-muted">{{ $t('home.spending.importing') }}</p>
      <p v-if="view && view.period.pendingHolds > 0" class="text-sm text-foreground-muted">{{ $t('home.spending.pending', { count: view.period.pendingHolds }) }}</p>
      <p v-if="view && state.status !== 'error' && rows.length === 0 && view.period.dataUntil !== null" class="text-foreground-muted">{{ $t('home.spending.empty') }}</p>

      <div v-if="view && total && rows.length > 0" class="flex gap-7" :class="{ 'opacity-60': state.status === 'loading' }">
        <div class="flex w-59 shrink-0 flex-col gap-3">
          <p class="sr-only">{{ $t('home.spending.title') }}: {{ money(total.net) }}</p>
          <CategoryRing
            :stops="ring"
            :label="who || $t('home.spending.title')"
            :amount="money(total.net)"
            :per-day="perDay"
            :chip
            :conv
          />
          <p v-if="!view.compare" class="text-center text-xs text-foreground-muted">{{ noCompareText(view.month) }}</p>
          <p v-for="l in leftOutLines(view)" :key="l" class="text-center text-xs text-foreground-muted">{{ l }}</p>
          <div class="grid grid-cols-2 gap-3 border-t border-border-subtle pt-3.5">
            <div class="flex flex-col gap-0.5">
              <span class="text-xs text-foreground-muted">{{ $t('home.spending.operations') }}</span>
              <span class="flex items-baseline gap-1.5">
                <span class="text-[15px] font-bold tabular-nums">{{ total.purchases }}</span>
                <span class="text-xs font-bold tabular-nums">{{ opsVs(total.purchases, total.prev?.purchases ?? null, view.month) }}</span>
              </span>
            </div>
            <div v-if="total.prev" class="flex flex-col gap-0.5">
              <span class="text-xs text-foreground-muted">{{ prevInText(view.month) }}</span>
              <span class="text-[15px] font-bold tabular-nums">{{ money(total.prev.net) }}</span>
            </div>
          </div>
          <PeopleList v-if="family" :rows="whoRows" @pick="onPick" />
          <div v-if="member && selected && view.familyTotal !== null" class="flex items-center gap-2.5 rounded-xl border border-border-subtle bg-surface-raised p-2.5">
            <span class="grid size-7 shrink-0 place-items-center rounded-full bg-(--c) text-[13px] font-extrabold text-white" :style="{ '--c': selected.color }" aria-hidden="true">{{ selected.name.slice(0, 1) }}</span>
            <span class="flex flex-col gap-0.5">
              <span class="font-semibold">{{ $t('home.spending.familyShare', { pct: shareOf(total.net, view.familyTotal).replace('%', '') }) }}</span>
              <span class="text-xs text-foreground-muted">{{ $t('home.spending.familyTotal', { amount: money(view.familyTotal) }) }}</span>
            </span>
          </div>
        </div>
        <div class="flex min-w-0 grow flex-col gap-0.5">
          <CategoryRow v-for="r in rows" :key="r.key" :row="r" :expandable="family" :open="open === r.key" @toggle="onToggle(r.key)" />
        </div>
      </div>

      <p v-if="view && rows.length > 0" class="text-sm text-foreground-muted">{{ $t('home.spending.footnote') }}</p>
    </div>
  </VCard>
</template>
```

- [ ] **Step 8: Typecheck and the architecture test**

Run: `pnpm --filter @mono/desktop typecheck && pnpm --filter @mono/desktop exec vitest run tests/architecture.test.ts tests/ui.test.ts`
Expected: PASS (layers: the feature imports `entities/*` and `shared/*` only; icons are registered).

- [ ] **Step 9: Commit**

```bash
git add apps/desktop/src/renderer/src/features/spending-summary
git commit -m "feat(desktop): the new spending block — category ring, people, comparison with last month, settings menu"
```

---

### Task 11: the feature mounted

**Files:**
- Create: `apps/desktop/tests/renderer/spending-feature.test.ts`

- [ ] **Step 1: Write the test**

```ts
// @vitest-environment happy-dom
// The spending block mounted: a person pick, a category expansion, the settings menu, one-person view.
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import type { SpendingOverview } from '@contract/api.ts';

const VIEW: SpendingOverview = {
  month: '2026-09',
  period: { from: '2026-09-01', to: '2026-09-30', days: 30, incomplete: false, dataUntil: '2026-10-01', coveredDays: 30, pendingHolds: 0 },
  compare: { from: '2026-08-01', to: '2026-08-31', partial: false },
  total: { net: 50_000, purchases: 10, netPerDay: 1_667, prev: { net: 40_000, purchases: 8 } },
  people: [
    { participantId: 1, net: 30_000, purchases: 6, prev: { net: 25_000, purchases: 5 } },
    { participantId: 2, net: 20_000, purchases: 4, prev: { net: 15_000, purchases: 3 } },
  ],
  categories: [
    {
      category: 'продукты', categoryId: 'groceries', net: 50_000, purchases: 10, prev: { net: 40_000, purchases: 8 },
      people: [
        { participantId: 1, net: 30_000, purchases: 6, prev: { net: 25_000, purchases: 5 } },
        { participantId: 2, net: 20_000, purchases: 4, prev: { net: 15_000, purchases: 3 } },
      ],
    },
  ],
  fx: [{ currency: 840, rate: 41, prevRate: 40, nearest: false }, { currency: 978, rate: null, prevRate: null, nearest: false }],
  leftOut: [],
  familyTotal: null,
};

const getSpendingOverview = vi.fn(async () => VIEW);
vi.mock('@/shared/api', () => ({ balanceApi: { getSpendingOverview: (...a: unknown[]) => getSpendingOverview(...(a as [])) } }));

beforeEach(() => {
  setActivePinia(createPinia());
  getSpendingOverview.mockClear();
});

async function mountBlock(selected: number | null) {
  const { i18n } = await import('@/shared/lib/i18n.ts');
  const { useParticipantStore } = await import('@/entities/participant');
  const participant = useParticipantStore();
  participant.view = {
    people: [
      { id: 1, label: 'Сергей', labelFromBank: false, labelPending: false, color: 'blue', connections: [] },
      { id: 2, label: 'Аня', labelFromBank: false, labelPending: false, color: 'orange', connections: [] },
    ],
    secureStorage: true,
  } as never;
  if (selected !== null) participant.select(selected);
  const { SpendingFeature } = await import('@/features/spending-summary');
  const w = mount(SpendingFeature, { global: { plugins: [i18n] } });
  await flushPromises();
  return w;
}

describe('spending block', () => {
  it('family: people list, a pick changes the centre, a category expands into people', async () => {
    const w = await mountBlock(null);
    expect(getSpendingOverview).toHaveBeenCalledWith({ month: expect.any(String), scope: 'personal' });
    const buttons = w.findAll('button[aria-pressed]');
    expect(buttons.map((b) => b.text())).toEqual(expect.arrayContaining([expect.stringContaining('Вся семья'), expect.stringContaining('Аня')]));

    await buttons.find((b) => b.text().includes('Аня'))!.trigger('click');
    expect(w.text()).toContain('20 000');

    const row = w.find('button[aria-expanded]');
    await row.trigger('click');
    expect(row.attributes('aria-expanded')).toBe('true');
    expect(w.text()).toContain('Сергей');
  });

  it('one person picked in the global filter: no people list, no expansion, the participant in the query', async () => {
    const w = await mountBlock(2);
    expect(getSpendingOverview).toHaveBeenCalledWith({ month: expect.any(String), scope: 'personal', participantId: 2 });
    expect(w.findAll('button[aria-pressed]').filter((b) => b.text().includes('Вся семья'))).toHaveLength(0);
    expect(w.find('button[aria-expanded]').exists()).toBe(false);
  });
});
```

The participant store's `view` shape is `PeopleView` (check `apps/desktop/src/shared/api.ts`); fill what it requires
instead of `as never` if the typecheck of `tsconfig.web.json` covers the tests. The month store needs no setup (it
starts at this month). If `useAsyncData` needs the sync-status store's `version`, it is a plain Pinia store and works
with the fresh pinia.

Run: `pnpm --filter @mono/desktop exec vitest run tests/renderer/spending-feature.test.ts`
Expected: PASS. If a reka-ui component needs `ResizeObserver` in happy-dom, stub it at the top:
`globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as never;`

- [ ] **Step 2: Commit**

```bash
git add apps/desktop/tests/renderer/spending-feature.test.ts
git commit -m "test(desktop): the spending block mounted — person pick, expansion, one-person view"
```

---

### Task 12: remove the old spending API

**Files:**
- Modify: `apps/desktop/src/shared/api.ts` (remove `SpendingQuery`, `SpendingLine`, `SpendingCurrency`, `spendingSummary`
  from `BalanceApi`; `SpendingView['period']` is used by `SpendingOverview.period` — inline that type there first)
- Modify: `apps/desktop/src/shared/channels.ts` (remove `'spendingSummary'`), `apps/desktop/src/main/ipc.ts` (its schema),
  `apps/desktop/src/main/index.ts` (its handler), `apps/desktop/src/main/data.ts` (`spending()` and its imports)
- Modify: `apps/desktop/tests/data.test.ts` (the two `spending:` tests), `apps/desktop/tests/ipc.test.ts` (the
  `spendingSummary` invalid inputs), and the participant-id test in `describe('DataService: one participant or the whole
  family')` if it calls `svc.spending` — port it to `spendingOverview`:

```ts
  it('spendingOverview takes participantId; without it — everyone', async () => {
    // (keep the fixture of the old test; replace the calls)
    const all = await svc.spendingOverview({ month: '2026-03', scope: 'personal' });
    const one = await svc.spendingOverview({ month: '2026-03', scope: 'personal', participantId: me });
    expect(one.total.net).toBeLessThanOrEqual(all.total.net);
  });
```

- [ ] **Step 1: Make the changes above**, then find leftovers:

Run: `grep -rn "spendingSummary\|SpendingView\|SpendingLine\|SpendingCurrency\|SpendingQuery" apps/desktop/src apps/desktop/tests`
Expected: no matches (core's `spendingSummary` import in `data.ts` stays — it is the core function, matched by the
grep only as `spendingSummary(`; check each remaining line is the core call).

- [ ] **Step 2: Run everything**

Run: `pnpm test && pnpm typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add -A apps/desktop
git commit -m "refactor(desktop): drop the old spendingSummary IPC and its view types"
```

---

### Task 13: docs and the changelog

**Files:**
- Modify: `.agents/project/desktop-renderer.md`, `.agents/project/domain-rules.md`, `CHANGELOG.md`

- [ ] **Step 1: `desktop-renderer.md`** — add after the «Блок балансов» bullet:

```md
- **Spending block** (`features/spending-summary`, `SpendingFeature.vue`; spec `docs/superpowers/specs/2026-10-02-spending-block-design.md`):
  one IPC `getSpendingOverview({ month, scope, participantId? })` (main: `DataService.spendingOverview`, helpers in
  `main/spending.ts`) — categories in hryvnia (account currencies folded by own exchanges, `leftOut` without a rate),
  `purchases`, the compared period (`compare`: last month, cut to the same day while the month is incomplete; null
  before the data), for the family each participant's part of every category. Renderer: `utils.ts` builds rows for the
  family or the block's own pick (`rowsFor`, top 7 + «Other»; colours by the family's rank), chips (`change`, 3% →
  «as in»), operations (`opsView`), the ring (`ringStops` / `ringOf`), «≈ $ / €» lines (`convertLines`, `centerConv`).
  Menu choices — `store/useSpendingPrefsStore.ts` (`localStorage` `spending.view`, defaults: split on, mark / $ / € off).
  The pick and the expanded category reset on month, scope and global filter changes. Layout: only the category name
  shrinks (ellipsis + title); numbers have fixed widths and never wrap. `shared/ui/VPopover` — ours on reka-ui.
```

- [ ] **Step 2: `domain-rules.md`** — in the spending aggregates section add:

```md
- `purchases` (spendingSummary, per group and per currency total): spending lines with `amount < 0`; a refund is not an
  operation, a commission is its own line («Bank fees»). `lines` counts every line, refunds included.
```

- [ ] **Step 3: `CHANGELOG.md`** — a new top section (the version after `apps/desktop/package.json` 0.1.6):

```md
## 0.1.7 — unreleased

### Spending

- The «Spending» block is new: a ring of categories with the month's total, and for each category its share, the
  number of operations and how much more or less it is than last month. While a month is in progress it is compared
  with the same days of last month.
- For the whole family the block shows who spent how much: click a person to see their part of the family's spending,
  or click a category to see each person's amount and operations in it.
- The gear in the block's corner chooses what the bars show — split by people, a mark at last month's amount — and can
  add amounts in dollars or euros next to the hryvnia ones, at the rate of your own exchanges. Totals stay in hryvnia.
- Spending on dollar and euro cards is now counted in hryvnia at the rate of your own exchanges, instead of a separate
  table per currency.
```

- [ ] **Step 4: Final verification**

Run: `pnpm test && pnpm typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add .agents/project/desktop-renderer.md .agents/project/domain-rules.md CHANGELOG.md
git commit -m "docs: the spending block — project notes, purchases, changelog 0.1.7"
```

---

## Manual smoke (the user, on real data)

- Home, «Whole family»: the ring, the people list, a click on a person and back, a category expanded and folded.
- Global filter on one person: no people list, no expansion, «N% of the family's spending».
- Only one person in the app: the same one-person view, no family card.
- The gear: each switch changes the bars / lines at once; restart the app — the choices stay.
- A month in progress: «… than by this day in …»; the first month with data: «No data for … to compare».
- A dollar card with spending and dollar exchanges: its spending is inside the hryvnia totals.
- Light and dark theme; a long category name next to many operations — nothing overlaps.

## Category palette

Decided (02.10.2026): a separate category palette (`--category-1…7`, Task 7 Step 1b). After the block is on screen,
check the palette in both themes and for colour-vision deficiencies; adjust the oklch values only.
