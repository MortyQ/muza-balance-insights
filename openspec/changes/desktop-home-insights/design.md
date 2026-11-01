# Design

## Context

See proposal.md (Why). Today `DataService.spendingOverview` (`apps/desktop/src/data/data.ts`) already works out what
the block needs to start from:
- `spendingUsual` takes the whole months behind the usual (`usualMonths`, at most 6, at least 3), folds one
  `spendingGrid` by month per category, and gives `usualOf` medians plus the income median for a month that is over;
- `insightsOf` runs core's `detectInsights` over it.

The per-month arrays (spending by category, income) live only inside `spendingUsual`. Payee text exists only in the
desktop: `merchantText` / `merchantKey` (`data/category.ts`) over core's `categoryLines`. Core summaries carry no
descriptions.

Follows: `.agents/project/domain-rules.md` (updated: driver and savings-rate rules),
`.agents/project/desktop-renderer.md` (updated: home grid, the block), `.agents/project/desktop-import.md` (updated:
`getSpendingOverview` now carries descriptions), `.agents/project/core-layout.md` (the rules go into `read/`).

## Goals / Non-Goals

**Goals:** one read for the spending block and the new block, with no second pass over the same months in main; pure
rules in core; the block hidden when it has nothing to say.

**Non-Goals:** driver per payee key across banks (a payee is its cut description, as on the category screen); drivers
for income lines; any change to the carousel.

## Decisions

### 1. Extend `SpendingOverview` instead of a new read
`SpendingOverview` gains `explain: { drivers, savings, basis } | null`. The block's feature reads `getSpendingOverview`
through its own api wrapper; the renderer's read cache and the in-flight sharing (`wrapBridge`) make the spending
block, the «What's unusual» slide and the new block one request.
- *Alternative: a new `getHomeInsights` read.* It would keep descriptions out of `getSpendingOverview`, but main would
  redo `spendingUsual` and `detectInsights` for the same query (the heaviest part of home). Rejected: the cost lands on
  every home open, the gain is one channel fewer with descriptions, and that channel feeds only home.

### 2. Drivers: one extra query, only when there is something to explain
`spendingOverview` computes drivers only when `insights` has category lines (at most five). It then reads their
body lines in one query (core `linesOfCategories`, so the overview runs a fixed number of statements whatever the
number of categories) over the usual months plus the shown month (the same filters: person, banks, scope, time zone),
groups body lines by `merchantKey(merchantText(...))` per month (net = −amount, refunds lower it),
and hands core per-payee `now` and per-month maps. Core picks the driver (`mainDriver`): median over the same months
(a missing month = 0), the biggest difference in the category's direction, share capped at 100, at least
`DRIVER_SHARE` (0.3). The name shown is the payee's most frequent spelling, as `lineStats` names merchants.
- *Alternative: drivers by payee across all categories.* Rejected: the block explains the carousel's lines, which are
  per category.
- *Alternative: biggest payee of the month without a usual.* Rejected: a payee that is always large (rent) would explain
  every change.

### 3. Savings rate from the arrays `spendingUsual` already builds
`spendingUsual` returns, for a month that is over, the per-month income and spending totals it already folds; core's
`savingsRate(now, months)` gives the month's rate and the median of the months with income (at least 3). A running
month: none.

### 4. The note's facts come with the answer
`basis: { months, from, to, pendingHolds }`: `from` / `to` are the oldest and newest usual month, `pendingHolds` is
the existing `period.pendingHolds`. The texts are i18n keys; nothing is worded in main.

### 5. FSD placement
- New feature slice `features/home-insights`: `api/useHomeInsightsRequest.ts` (wrapper over `getSpendingOverview` /
  `readCache.peek`), `composables/useHomeInsights.ts` (home's month, person, banks, `useScopeStore`; returns the view
  and `visible`), `utils.ts` (`homeInsightsView`: rows, savings line, note), `components/HomeInsightsTile.vue`,
  `HomeInsightsFeature.vue`, `index.ts`.
- `pages/home/HomePage.vue` puts `HomeInsightsFeature` after `SpendingFeature`. `SpendingFeature` cannot know about the
  other slice, so the page tells it: `SpendingFeature` takes a `beside` prop (true → `@[79rem]:col-span-7`, else
  `col-span-full`), and the page reads `visible` from `useHomeInsights` through the feature's public composable. Both
  slices stay unaware of each other.
- *Alternative: a widget composing both.* Rejected: the page already composes the grid; a widget around two tiles adds a
  layer for one prop.

### 6. Privacy
The driver's name is `merchantText` (card numbers cut to the last 4, jar titles hidden), the same as «Recent
operations». No IBAN, `counter_name` or comment reaches the renderer. The MCP server and the analysis copy are
untouched.

## Risks / Trade-offs

- [Extra query on every home open with unusual categories] → one read over ≤ 7 months for all of them, only when
  insights exist; `tests/data-queries.test.ts` keeps the statement count fixed.
- [Payee spelling varies (a card number, a city suffix)] → `merchantKey` collapses case and spaces only; a split payee
  shows a smaller share and may fall under 30%: no driver rather than a wrong one.
- [A ratio of medians would mislead for the savings rate] → the usual rate is the median of monthly rates, not
  usual income over usual spending.
- [Descriptions travel in a read that the spending block also uses] → recorded in `desktop-import.md`; the user's ok is
  asked in this review.

## Migration Plan

None: no stored data, no migration. Rollback is reverting the commits.
