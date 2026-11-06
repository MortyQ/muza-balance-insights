# Proposal

## Why

Testing feedback (the «Improvements» section of the bug page) keeps coming back to the same small frictions: one bank
operation is called «operation», «op.» or «transaction» depending on the screen; a change against a small base reads
as «399% more than in August», which says less than the money; several figures and marks («pending», «−4», «… a day»,
«Free», «Compared with …») have no explanation; and the operations table keeps an empty «Marks» column. None of it is
a new feature, but together they make the screens harder to trust. The limits already speak in «×N» and money since
figure-accuracy; the rest of the app should do the same.

## What Changes

- **One word for a bank operation**: «transaction» in every language (uk «транзакція», ru «транзакция», en
  «transaction»), with full plural forms; the «op.» abbreviation goes. «Operations» → «Transactions», «Recent
  operations» → «Recent transactions», and the same in import, upload and settings texts that still say «operation».
- **A change says money first, and «×N» instead of a large percent**: one shared rule (`changeText`): under +100% —
  «+90 ₴ (9%)» as now; from twice the base — «+105 € (×5.0)»; above ten times the base — the money alone, the base in
  the hint. Decreases keep the percent (it never passes 100%). Used by every change chip: the category and income
  screens, home «Spending», «What's unusual», «Today» / «This week» and the Insights feed.
- **Hints where a figure or mark is not obvious**:
  - a «?» (`VHelpHint`) on home's «Balance», «Month pace», «Today» / «This week», «Spending» and «Insights», and on
    «Analytics»' totals, «Income and spending» chart, changes list and category views: what the block counts and what it
    leaves out, in two or three sentences;
  - a tooltip on the «pending» mark in the category and income lists and in «Recent transactions»;
  - tooltips on the count change by «Spending» («4 fewer transactions than in August»), on «… a day» («Average per
    calendar day»), on «Compared with …» in «Analytics» («The period right before yours, of the same length») and on
    «Free» on the balance card («Money on cards minus reserves»).
- **The «Marks» column hides** when no row in the list has a mark, and the row takes the width back.
- **Wording**: «Not a regular payment» → «Hide from regular payments»; «Stopped» → «Not seen in recent months»; the
  empty search state of a category list says what was searched and where («No transactions match “…” in this category
  and month»); the budget and limits «?» texts say that pending holds are left out until the bank finalises them (the
  behaviour since figure-accuracy; the spec still said they count).

## Capabilities

### New Capabilities
- `desktop-ui-wording`: the shared rules of the interface's words: the one term for a bank operation, how a change is
  said (money, percent, «×N»), and that a non-obvious figure or mark carries a hint.

### Modified Capabilities
- `desktop-budget-help`: «What is counted and what is not» — pending holds are left out of limits and the budget
  (aligns the spec with figure-accuracy).
- `desktop-recent-operations`: the block is named «Recent transactions»; a pending row's mark explains itself.

## Impact

- `apps/desktop` only: the renderer (`shared/lib/change.ts`, a shared `times()` in `shared/lib`, `entities/operations`,
  `features/now-strip`, `features/spending-summary`, `features/insights-page`, `features/home-insights`,
  `features/analytics-overview`, `features/balances`, `widgets/home-highlights`, the regular payments feature) and the
  dictionaries `uk.json`, `en.json`, `ru.json`. Main's dictionary texts (`main.*`) only where they say «operation».
- No core, MCP, IPC, storage or security change. No trust anchor changes.
- User-visible: a `CHANGELOG.md` entry under `## 0.1.14 — unreleased` («Clearer words and hints»).
- Renderer tests that read Russian texts («операции», «оп.», «%») are updated with the dictionaries.

**Out of scope**: search in «Spending» and the global search, the «Large one-off» chip in «Today» / «This week», the
«Lines» chart's axis caption and tooltip, the balance card's layout items, the regular payments' second line («last
paid … · not seen for N months»), the period picker's redesign, any change of what is counted.
