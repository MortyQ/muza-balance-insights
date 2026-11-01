# Design

## Context

`DataService.spendingOverview` already finds the usual (`spendingUsual`: up to 6 whole months, one `spendingGrid` by
month, one `incomeSummary` by month), runs core `detectInsights` and explains the first five lines (`explain`: one
`linesOfCategories` read, `mainDriver`, `savingsRate`). The page needs the same facts for every insight, each
category's monthly series, and payee-level signals across all categories of the month.

Follows: `.agents/project/domain-rules.md` (updated: severity, new payees, one-offs), `desktop-renderer.md` (the
screen), `desktop-import.md` (the new channel carries descriptions), `core-layout.md` (rules in `read/`).

## Goals / Non-Goals

**Goals:** one read for the screen with a fixed number of statements; pure rules in core; the important things first
(a glance row, then the feed ranked by money with severity, then the side lists); no chart library per card.

**Non-Goals:** sharing the read with home (the page asks for more: all insights, series, lines of every category);
dismissing insights; ranges of months.

## Decisions

### 1. A new read `getInsightsOverview` instead of growing `getSpendingOverview`
The page's answer reads every category's lines over the usual months and the shown one; home opens on every launch and
must not pay for that. The new read reuses the private helpers (`spendingUsual`, `insightsOf`, `jarTitles`), so the
rules stay one. Query = `SpendingOverviewQuery` (month, scope, person, banks), the same zod schema.
- *Alternative: extend `SpendingOverview` again.* Rejected: every home open would read all lines of 7 months.

### 2. Statements: summary + usual + one lines read
`insightsOverview` runs `spendingSummary` for the month, `spendingUsual` (grid + income), and — when there is a usual —
one `linesOfCategories` over the usual months and the shown one for every category spent in the shown month plus every
insight's category. Drivers (all insights), new payees and one-offs all come from that one read.
`tests/data-queries.test.ts` checks the count does not grow with months or categories.

### 3. Severity relative to a usual month's spending
`insightSeverity(amount, usualTotal)`: share = amount / usualTotal; high ≥ 0.10, medium ≥ 0.04, else low (no usual
total → low). One scale for categories and income, so a family with large spending is not flooded with «high» marks.
- *Alternative: by per cent of the category's usual.* Rejected: a tiny category doubling would read as high.

### 4. New payees and one-offs over payees of all categories
The lines are grouped by `merchantKey(merchantText(...))` across categories (`payeeMonths`, already used for drivers);
a payee's category on the screen is the category of most of its shown-month spending. Core:
- `newPayees(payees, min = INSIGHT_MIN)`: now ≥ min and every usual month 0; largest first, ties by name; at most
  `SIGNALS_MAX` (10).
- `oneOffs(ops, usualTotal)`: each op `{ key, amount (> 0 spent), payeeUsual }`; kept when amount ≥ max(INSIGHT_MIN,
  usualTotal × ONE_OFF_SHARE (0.10)) and payeeUsual < amount / 2; largest first, ties by key; at most `SIGNALS_MAX`.
  A refund is not an operation here; a hold counts (it is spending as shown elsewhere).

### 5. Series for the cards
`spendingUsual` keeps each usual month's per-category nets (it already builds them); the answer carries, per
insight, `series`: the usual months oldest first and the shown month last, hryvnia kopecks. Income insights get the
months' income. The renderer draws them as CSS bars (thin, rounded, on the sunken track, the usual as a dashed line),
not ECharts: up to a dozen cards would mean a dozen chart instances.

### 6. FSD placement
- `pages/insights/InsightsPage.vue` (thin) → `features/insights-page`: `api/useInsightsRequest.ts`,
  `composables/useInsightsPage.ts` (home's month, person, banks, scope, quiet reload on `syncStatus.version`),
  `utils.ts` (`insightsPageView`: glance figures, cards, side lists, note), components `InsightsGlance.vue`,
  `InsightCard.vue`, `InsightBars.vue`, `PayeeSignals.vue`, `InsightsBasis.vue`, `InsightsFeature.vue`, `index.ts`.
- Route `insights` (`ROUTE.insights`), `meta.nav` order 1 (after «General»; «Analytics» and the rest move by one),
  icon `lucide:lightbulb`, the default month filter.
- Home links: `features/home-insights` and `features/spending-summary`'s slide get a «All insights» link to the route.

### 7. Layout and density
Container grid: one column; from 64rem of its own width the feed takes 8 of 12 columns and the side lists 4. The glance
row: 2 columns, 4 from 48rem. A card holds one sentence, one chart 64 px high, at most one driver line; secondary text
is `text-xs text-foreground-muted`. Severity is a small label in the body face, not tracked capitals, with a coloured
dot-free left border (high = orange, medium = muted orange, low = border colour); direction keeps home's tones (orange
more, blue less).

### 8. Privacy
Payee names via `merchantText` (card numbers cut, jar titles hidden). No IBAN, `counter_name` or comment. The MCP server
and the analysis copy are untouched.

## Risks / Trade-offs

- [All lines of 7 months in one read] → one statement, only on this screen; the read cache keeps the answer.
- [A payee split by spelling] → `merchantKey` collapses case and spaces only; a split payee may look new. Accepted, as
  for drivers; listed in the backlog's live checks.
- [Severity thresholds are a guess] → constants in core, easy to tune after the user's live check.

## Migration Plan

None: no stored data. Rollback is reverting the commits.
