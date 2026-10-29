# Design

## Context

See proposal.md for why.

- **Core.** `spendingLinesSql` (`read/spending.ts`) builds the line rules once for `spendingSummary`, `spendingGrid` and
  `categoryLines`. For the per-person grouping it already joins `connections` and carries `participant_id` through
  `base` and `lines`. `spendingGrid` groups lines by currency × bucket (day or month) × category in one query.
- **Data process.** `spendingOverview` (`src/data/data.ts`) runs one `spendingSummary` by category for the view and, in
  the family view, one per person for `SpendingCategoryView.people`. `analyticsOverview` runs one `spendingGrid` and
  folds it per cell with `foldCells` (`src/data/analytics.ts`). `cellGroups` (`src/data/spending.ts`) sums grid cells
  per currency and key before folding.
- **Renderer.** `features/spending-summary`: `SpendingPrefs { split: boolean; mark: boolean }` in `localStorage`
  (`parsePrefs` forgives each field), the bars menu `SpendingSettings` (`PrefSwitch` rows in a `VPopover`), and
  `rows.ts` builds each bar's `segments` from `c.people`. `features/analytics-overview`: `FlowChart` draws
  `flowChartOption(view, fmt)`, two line series (income, spending), running totals for one month. `entities/bank`'s
  looks have a monogram class only, no colour.

Rules followed: `.agents/project/core-layout.md`, `domain-rules.md`, `desktop-import.md`, `desktop-renderer.md`.
Updated: `desktop-import.md` (the two new answer fields and the split grid); `domain-rules.md` gets one line on the
split grid under the «bank view» bullet.

## Goals / Non-Goals

**Goals:**
- One query for the bank split in each view: the spending block adds one statement, analytics adds none.
- Every figure shown today stays exactly the same.

**Non-Goals:**
- No split of the ring, of income, or of the other analytics views.
- No per-bank split of a person picked inside the «Spending» block (below).

## Decisions

### 1. Core: `spendingGrid` with `byProvider`

`spendingLinesSql` gains a `byProvider` flag next to `byPerson`: it joins `connections` once for either and carries
`c.provider AS provider` (else `NULL`) through `base` and the three `lines` branches. `spendingGrid(db, q & { byProvider?:
boolean })` adds `provider` to its `GROUP BY`, and `SpendingCell` gains `provider: ProviderId | null` (null without the
flag). A fee line keeps its debit row's account, so it lands in the sending bank. The MCP tools do not use the grid.

*Alternative:* a `provider` key for `spendingSummary`'s `groupBy`. Rejected: the spending block needs category ×
bank and analytics bucket × bank; only the grid has two keys.

### 2. Data process: two new fields, the old figures untouched

- `SpendingCategoryView.banks: Array<SpendingAmounts & { provider: string }>`: one `spendingGrid` over the shown month
  (`unit: 'month'`, the view's filters, `byProvider`), folded with `cellGroups` keyed by category and bank, registry order
  (`PROVIDER_IDS`), banks with any line. Current month only: the bars draw the current amounts.
- `AnalyticsOverview.spendingByBank: Array<{ provider: string; values: number[] }>`: the existing analytics grid gets
  `byProvider`. Before `foldCells`, `mergeCells` sums the split cells back per currency × bucket × category, so every
  existing figure is folded from exactly the cells it is folded from today. Each bank's values are `cellGroups` of its
  cells keyed by bucket, folded per bucket. A day series is per day; the renderer runs the totals as it does for spending.

The family's per-person groups are unchanged. `tests/data-queries.test.ts` gets the spending block's new count.

*Alternative:* one `spendingSummary` per bank. Rejected: the statement count would grow with the number of banks.

### 3. Bank colours in `entities/bank`

`BankLook` gains `color` (a CSS value): Monobank `var(--foreground)`, PrivatBank `var(--series-green)`, A-Bank
`var(--series-blue)`, Slovenská sporiteľňa (merged from main during this change) `var(--series-red)`, a bank the
registry does not know `var(--border-strong)`. Theme tokens, so both themes read. The
«By bank» cards of `bank-breakdown` use it instead of `var(--cat)`.

### 4. «Spending»: one split choice

`SpendingPrefs.split` becomes `'together' | 'people' | 'banks'`; `parsePrefs` reads `true` as `'people'` and `false` as
`'together'`, an unknown value as the default `'people'`. The menu's switch becomes a `VSegmentedControl` (`shared/ui`)
titled «Split the bars», showing only the options that apply: «By people» in the family view with two or more people,
«By banks» while `participant.shown.length > 1`. `rows.ts` takes the effective split (the choice, or `'together'` when it
does not apply) and builds `segments` from `c.banks` with `bankOf(provider)` names and colours, positive parts only.
With a person picked in the block's people list, «By banks» bars are drawn together: the bank parts are the view's, not
the pick's. The choice itself is never rewritten by the fallback.

*Alternative:* a separate «By banks» switch beside «Who spent how much». Rejected: both on would ask for two splits of
one bar.

### 5. «Analytics»: a switch on the chart

`FlowChart` gets a `VSegmentedControl` «Together / By banks» in its header, shown while `participant.shown.length > 1`;
the choice lives in the feature (`localStorage` `analytics.flowSplit`, read and written in `try`/`catch`).
`flowChartOption(view, fmt, banks)` with `banks` (names and colours, or null) replaces the spending line with one line
series per bank, `stack: 'spending'` with `areaStyle`, in the bank's colour; the stack's top is the total. The legend
lists the banks; the screen-reader list adds each bank's part to a row.

*Alternative:* one line per bank, not stacked. Rejected: it hides the total the user compares income with.

## Risks / Trade-offs

- **[Risk]** PrivatBank's green is close to the income line's green. → The income line stays a line and the banks are
  filled areas; the legend names both. Revisit after a look on a live system (backlog).
- **[Trade-off]** With foreign-currency spending a bank's parts may differ from the total by a kopeck: each part is
  folded on its own. → As the people's parts today; the totals themselves are unchanged.
- **[Risk]** One more statement for the spending block. → The grid is the same shape as analytics' and the bench covers
  `spendingGrid`.
