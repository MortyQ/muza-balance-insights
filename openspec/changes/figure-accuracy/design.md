# Design

## Context

How these figures are counted today:
- **Spending.** Every figure comes from one SQL builder, `spendingLinesSql` (`packages/core/src/read/spending.ts`). It
  is used by `spendingSummary`, `spendingGrid` and `categoryLines`. Holds pass through it like final operations; only
  `periodInfo.pendingHolds` counts the fresh ones (`hold = 1`, the last `RESYNC_OVERLAP_SEC`, 3 days).
- **Limits and the budget.** The desktop data process sums them (`apps/desktop/src/data/data.ts` → `limitsOverview`,
  `limitsOverOf`; `apps/desktop/src/data/limits.ts`) from `spendingGrid` and `spendingSummary`. It then calls the pure
  core helpers (`read/limits.ts`: `limitState`, `budgetParts`).
- **«Cash».** It is a spending category: MCC 6010 and the banks' hints, `wants` by default (`read/category-kinds.ts`).
- **Core preferences.** Core keeps on/off preferences in the `settings` table (`people/settings.ts`, only non-default
  values stored). `apps/mcp` exposes them through its `settings:*` script.
- **Category rules.** They live in `derive/categories.ts`. The desktop import worker (`src/worker/run-import.ts`) runs a
  full `rederiveCore` only when the accounts' inputs changed or a window's derivation failed. Otherwise it re-derives
  the touched spans. A new MCC rule therefore never reaches old operations on the desktop.
- **«Limit exceeded».** The card is built in `limitsOverOf` and worded in the renderer
  (`features/insights-page/utils.ts`, `limitCard`).

Rules this change follows:
- `.agents/project/core-layout.md`;
- `.agents/project/domain-rules.md`, which it updates: holds in limits, the cash switch, the rules version;
- `.agents/project/desktop-renderer.md`;
- `.agents/project/desktop-app.md`, for IPC naming.

It is not security-relevant: no network, token, CSP or lock change. The renderer gets two more IPC calls with plain
booleans.

## Goals / Non-Goals

**Goals:**
- One place decides whether a line counts. Holds and cash are rules of `spendingLinesSql`, not post-filters in the
  desktop, so the MCP tools and every screen agree.
- Limits, the budget and the Insights feed stop flickering on holds, and the pending amount stays visible.
- Rule changes reach stored categories without the user running anything.

**Non-Goals:**
- Holds in «Spending» on home and in Analytics: they stay counted, as the «Now» strip and the totals show them.
- A per-budget list of excluded categories: only taxes, as asked.
- «Cash on hand».

## Decisions

1. **Holds are a spending filter.**
   - `SpendingFilters` gets `holds?: 'all' | 'final' | 'pending'`, default `'all'`, today's behaviour.
   - `spendingLinesSql` gets `nowSec` and adds `NOT (t.hold = 1 AND t.time >= ?)` for `'final'`, or the opposite for
     `'pending'`. The window is `RESYNC_OVERLAP_SEC`, the one `periodInfo.pendingHolds` uses.
   - The pending figures for a limit are the same grid read with `'pending'`, so the counts and amounts follow the
     same line rules: commissions, transfers, refunds.
   - Alternative: subtract a separate holds query in the desktop. Rejected: a second copy of the line rules that would
     drift (a hold's commission, a hold on a crossing transfer).
   - Verdict: a filter.
2. **Where holds are left out.** `limitsOverview` (both grids), `limitsOverOf`, and the shown month of the Insights
   overview and of home's «What's unusual» read with `holds: 'final'`. The usual months need nothing: holds older than 3
   days are final anyway. Home's «Budget» row reads `limitsOverview`, so it follows. Every other read keeps `'all'`.
3. **Cash is a core preference read inside `spendingLinesSql`.**
   - New key `cash_is_spending` in `SETTING_DEFAULTS` (default `true`). `read/spending.ts` may import `people/` (a
     lower layer).
   - While off, the body of a line whose category is cash is excluded as `internal` is. The commission line stays (it
     is a «комиссии банка» line already).
   - `cashWithdrawn(db, q, nowSec)` in `read/spending.ts` returns the net cash bodies per currency, for the month block.
   - Alternative: re-categorise cash as an own transfer at derive time. Rejected: the switch would need a full
     re-derivation, and the stored category would lie.
   - Alternative: a renderer-only filter. Rejected: the MCP tools, the usual months and the detectors would disagree.
   - Verdict: a preference in core.
   - The setting is read once per query. It is one row by primary key on a table of at most a few rows, so the
     bench budgets are not at risk; the bench runs in group 6 to confirm.
4. **Taxes are a column of the budget.**
   - Migration `v21`: `ALTER TABLE goals ADD COLUMN count_taxes INTEGER NOT NULL DEFAULT 1 CHECK (count_taxes IN (0,
     1))`. The default keeps old budgets as they are.
   - `BudgetInput` gets `countTaxes: boolean`. `checked()` refuses a taxes fixed row while it is false.
   - `budgetView` leaves taxes out of `flexibleWords`. The sheet's preview (`past.byCategory`) is already per category,
     so the renderer drops taxes there itself.
   - Alternative: a general list of excluded categories per budget (a `goal_excluded` table). Rejected for now: one
     need, and the column can become a table later without changing the screen.
5. **A rules version for derived categories.**
   - `CATEGORY_RULES_VERSION` (an integer) in `derive/categories.ts`, bumped with any rule change. This change takes it
     to 2; a missing row reads as 1.
   - `derived_state` key `category_rules` holds the version the last full pass used. `rederiveCore` writes it.
   - `rulesChanged(db)` in `derive/rederive.ts` compares the two. The worker adds it to the full-pass condition at the
     end of an import, and the statement upload path does the same.
   - `apps/mcp` `sync` is the user's command. It goes through `rederiveSpans` in core, and the user's `recategorize`
     does a full pass anyway.
   - Alternative: a migration that rewrites the categories of MCC 4111 and 4789 rows in SQL. Rejected: it would have to
     repeat the rule order (manual, payee, transfer, crossing).
   - Alternative: a full pass when the data process opens the database. Rejected: it blocks the first screen on a
     large history. The worker already reports a «rederive» phase.
   - `recategorize` imports `derive/rederive.ts`: it gains a `derived_state` write and no new output, so
     `recategorize-safety.test.ts` (a trust anchor) needs no edit.
6. **«Forecast above the limit».**
   - `limitsOverOf` becomes `limitSignalsOf`. It returns `limitsOver` and `limitsAhead`; the shown month's sums use
     `holds: 'final'`.
   - A monthly limit or the budget's flexible part is ahead when `limitState` gives a forecast above the amount, spent
     ≤ amount, and the forecast counts (current month, `FORECAST_FROM`).
   - `LimitAheadView = { categoryId | null, amount, spent, forecast, over, perDay, severity }`, with severity from
     `insightSeverity(over, usualTotal)`.
   - The renderer's `limitCard` gains a sibling `limitAheadCard`, merged into the feed by the same money ordering.
7. **IPC and the renderer.** The FSD placement:
   - **IPC:** `cashCounts(): boolean` and `setCashCounts(on)` in `shared/api.ts` and `ipc-args.ts`, with no
     deny-listed word in the names. The data process's change event refreshes the read cache, as `setCategoryKind`
     does.
   - **`entities/goal`:** `components/PendingNote.vue`, the quiet «+ N pending, X» with its tooltip. It is used by the
     «Budget» screen, home's «Budget» row and the category screen's limit bar, all of which already import
     `entities/goal`.
   - **`features/settings/category-kinds`:** the cash switch (`components/CashSwitch.vue`, `composables/useCashCounts.ts`)
     and the «not counted» mark on the «Cash» row.
   - **`features/limits-goals`:** the «Count taxes» switch in the budget sheet, and the preview without taxes.
   - **`features/insights-page`:** `limitAheadCard`, and the count note's new wording.
   - **`features/balances`:** «Withdrawn in cash» in the pace figures, read with the month block's existing read (a
     `cashWithdrawn` field, null while cash counts).
   - Every text is an i18n key in `uk`, `en` and `ru`.

8. **The state follows the pace** (added after the first review on live data: «On track» on day 2 with a quarter
   of the limit spent).
   - `limitState` adds attention when spending is at least `PACE_RATIO` (1.3) times the expected amount and at least
     `PACE_SHARE` (5%) of the limit above it, from the first day. The forecast rule after `FORECAST_FROM` and the 80%
     share stay. Both thresholds together keep one early purchase from raising it: 60 € on day 1 of a 1 050 € budget
     is 25 € (2.4%) over the plan.
   - It returns the reason (`pace` → `forecast` → `share`), the pace (`under` below 90% of the plan, `even` to 110%,
     `ahead` above) and `forecastShown` (from day `min(5, ⌈days / 4⌉)`), so the renderer words it without rules.
   - Renderer: `entities/goal` — the state words by reason, and a neutral `ahead` look in `STATE_LOOK` for an
     on-track limit ahead of its plan (the bar keeps the on-track fill).
   - The Insights «Forecast above the limit» card follows the reason (`pace` or `forecast`), so the feed and the
     «Budget» screen agree.
   - Alternative: only lower `FORECAST_FROM`. Rejected: the forecast from two days is noise either way, while the pace
     against the plan by today is what the bar already draws.
   - The thresholds are guesses from two real cases; the live check tunes them (`docs/backlog.md`).

## Risks / Trade-offs

- **The budget and «Spending» differ by the holds.** With pending holds, home's «Spending» and the «Budget» row
  differ. The pending note explains it; the spec keeps «Spending» with holds on purpose, because the bank's balance
  already counts them.
- **A hold the bank never finalises.** The API can keep a hold flagged; after 3 days it counts as final, as
  `pendingHolds` already assumes.
- **The cash switch changes historical figures at once.** The usual months, the suggestions and past budgets shift.
  That is the intent; the «Categories» hint says so.
- **One full re-derivation after the update** makes the first import longer. It is reported as the existing
  «rederive» phase.
- **The MCP tools follow the cash switch.** Someone who reads `apps/mcp` output after turning it off sees smaller
  spending. That is consistent, and it is noted in `domain-rules.md`.
