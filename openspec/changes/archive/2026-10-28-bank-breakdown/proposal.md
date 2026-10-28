# Proposal

## Why

The bank filter (change `bank-view-filter`) lets the user look at one bank at a time, but not see how a category or an
income splits between their banks at a glance. The category and income screens already show this split by person
(«Who spent», «Who received»). The same bars by bank answer «which card do I pay this with» without switching the
filter bank by bank.

## What Changes

- The category screen and the income screen get a «By bank» card: one bar per bank with the bank's mark, name, amount,
  number of operations and average, on the largest bank's scale. It sits beside «Who spent» / «Who received» and looks
  like them.
- The card shows the banks of the current view: the chosen banks of the bank filter and the chosen person (or the
  whole family). It appears only when at least two banks have something in the period.
- The parts add up to the screen's total: a bank's part is the sum of the screen's own operations on that bank's
  accounts, under the bank view's rules (own transfers between banks stay out; a transfer fee belongs to the bank it
  was sent from).
- The category and income answers of the data process carry a per-bank part, counted from the same operations as the
  per-person part. No new query, no core change.
- `CHANGELOG.md`: one entry under 0.1.13 next to the bank filter's, «See which bank you pay with».

Affected: `apps/desktop` only (the data process and the renderer). `packages/core`, `packages/db-libsql` and
`apps/mcp` do not change. No trust anchor changes.

Out of scope:
- per-bank rows in the home «Spending» block and per-bank balances in the balances block (the user chose the category
  and income screens only);
- a per-bank split in «Analytics» or in regular payments;
- picking a bank by clicking its bar (the bank filter does that);
- bank colours: the bars use the screen's own colour, the bank's mark tells them apart.

## Capabilities

### New Capabilities

- `desktop-bank-breakdown`: the per-bank split of the category and income screens — which banks are shown, what a part
  counts, when the card appears.

### Modified Capabilities

None. The bank filter's spec (`desktop-bank-filter`, from `bank-view-filter`) is not changed: the breakdown follows the
view it defines.

## Impact

- `apps/desktop/src/shared/api.ts`: `CategoryOverview.banks`, `IncomeOverview.banks`.
- `apps/desktop/src/data/category.ts` (`lineStats`, `incomeStats`) and `src/data/data.ts`.
- Renderer: `entities/operations` (the bars component takes a mark slot), `features/category-detail`,
  `features/income-detail`; i18n keys in `uk.json`, `en.json`, `ru.json`.
- Tests: the data process's stats tests, the renderer's category and income screen tests.
- User-visible: yes, the CHANGELOG entry above.
