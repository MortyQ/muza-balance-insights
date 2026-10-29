# Proposal

## Why

With every bank on, the home «Spending» block and the «Analytics» chart show one sum per category or per day. The user
wants to see in the same picture how much went through each bank, the way the «Spending» bars already split by person,
and still be able to see everything as one.

## What Changes

- Each bank gets a colour of its own, next to its mark: Monobank the foreground colour (black in the light theme),
  PrivatBank green, A-Bank blue.
- **«Spending» on home**: the bars menu's «Who spent how much» switch becomes a choice of how a category's bar is split:
  «Together» (one colour), «By people» (as today) or «By banks» (a segment per bank in its colour, with the bank and the
  amount on hover). «By people» is offered in the family view with two or more people, «By banks» with two or more banks
  on in the bank filter; an option that does not apply falls back to «Together». The stored choice carries over: the old
  switch on → «By people», off → «Together».
- **«Analytics» chart**: a «Together / By banks» switch over the income and spending chart. «By banks» draws spending as
  stacked areas, one per bank in its colour, whose top edge is the total; income stays one line. Offered with two or more
  banks on; remembered on this computer.
- **«By bank» cards** (category and income screens, change `bank-breakdown`): the bars take the bank's colour instead
  of the screen's.
- **Core**: the spending grid can split its cells by bank, so both views come from one query each.
- `CHANGELOG.md`: one entry under 0.1.13.

Affected: `packages/core` (the spending grid), `apps/desktop` (the data process and the renderer). `apps/mcp` and
`packages/db-libsql` do not change. No trust anchor changes. User-visible: yes.

Out of scope:
- splitting the «Spending» ring by bank (the ring stays by category);
- splitting income by bank in the chart, or other analytics views (heatmap, category views, compare);
- a per-bank split of the balances block.

## Capabilities

### New Capabilities

- `desktop-spending-split`: how the home «Spending» bars and the «Analytics» chart split spending — together, by people,
  by banks — and the colours banks are drawn in.

### Modified Capabilities

- `core-bank-view`: an added requirement — the spending grid can be split by bank, and the split cells add up to the
  unsplit ones.

## Impact

- Core: `read/spending.ts` (`spendingLinesSql`, `spendingGrid`), its tests and the bench.
- Data process: `src/shared/api.ts` (`SpendingCategoryView.banks`, `AnalyticsOverview.spendingByBank`),
  `src/data/data.ts`, `src/data/spending.ts`; `tests/data.test.ts`, `tests/data-queries.test.ts`.
- Renderer: `entities/bank` (a colour per look), `features/spending-summary` (prefs, settings menu, rows),
  `features/analytics-overview` (chart option, switch), `features/category-detail`, `features/income-detail`; i18n keys
  in `uk.json`, `en.json`, `ru.json`; renderer tests.
