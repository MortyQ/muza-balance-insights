# Tasks

## 1. Core: the grid split by bank — `feat(core): spending grid split by bank`

- [x] 1.1 `read/spending.ts`: `spendingLinesSql` carries `provider` with `byProvider`; `spendingGrid` takes
      `byProvider` and `SpendingCell.provider` (design, decision 1). Verify in `tests/read/bank-view.test.ts`: the split
      cells add up to the unsplit grid per currency, bucket and category; an own transfer is in no cell and its fee is
      in the sending bank's cell; without the flag the grid is unchanged (`provider: null`).
- [x] 1.2 One line on the split grid under the «bank view» bullet of `.agents/project/domain-rules.md`. Run the core
      checks (`tsc` both configs, `vitest`) and the bench against `bench/budgets.ts`.

## 2. Data process: bank parts — `feat(desktop): bank parts of spending and analytics`

- [x] 2.1 `src/shared/api.ts`: `SpendingCategoryView.banks`, `AnalyticsOverview.spendingByBank`. `src/data/data.ts`,
      `src/data/analytics.ts` (`mergeCells`), `src/data/spending.ts` as in design, decision 2. Verify in
      `tests/data.test.ts` («a bank view» block): each category's bank parts add up to its net; `spendingByBank` adds up
      to `spending` per bucket; with one bank on only that bank is listed; every existing analytics figure is the same
      as before the split. Update `tests/data-queries.test.ts` for the spending block's new count.
- [x] 2.2 Note the two fields and the split grid in `.agents/project/desktop-import.md`. Run the desktop checks.

## 3. Renderer: «Spending» bars by bank — `feat(desktop): spending bars split by bank`

- [ ] 3.1 `entities/bank`: `BankLook.color` (design, decision 3); the «By bank» cards of the category and income
      screens use it. Verify in `tests/renderer/registry-banks.test.ts` (every bank has a colour, an unknown one grey)
      and the screens' tests.
- [ ] 3.2 `features/spending-summary`: `SpendingPrefs.split` as a choice with the old switch carried over, the
      «Split the bars» control in the bars menu, `rows.ts` segments by bank (design, decision 4). Keys in `uk.json`,
      `en.json`, `ru.json`. Verify in `tests/renderer/spending*.test.ts`: by banks — a segment per bank in its colour with
      its amount on hover; together — one segment; «By banks» hidden and the bars together with one bank on, back with
      two; «By people» hidden for one person; a pick draws the bars together; a stored `true` / `false` reads as people /
      together.

## 4. Renderer: the analytics chart by banks — `feat(desktop): analytics chart split by bank`

- [ ] 4.1 `features/analytics-overview`: the «Together / By banks» switch, its stored choice, `flowChartOption` with
      stacked bank areas (design, decision 5). Keys in `uk.json`, `en.json`, `ru.json`. Verify in
      `tests/renderer/analytics.test.ts`: by banks — one stacked area per bank in its colour, the stack's top equal to the
      spending line, income unchanged, for a month (running) and a range; the switch hidden with one bank on; the choice
      remembered.
- [ ] 4.2 `CHANGELOG.md`, 0.1.13: one entry for both splits. Flag it to the user for review. Run the desktop checks.

## 5. Checks

- [ ] 5.1 Add to `docs/backlog.md`, the bank filter's section: with real data from two or three banks, the bars and the
      chart by banks add up to the totals; the bank colours in both themes, PrivatBank's green beside the income line.
- [ ] 5.2 Run each package's checks (core, mcp, desktop) and report the counts; ask the user to run `pnpm test` and
      `pnpm typecheck` at the root and the desktop build.

## Workflow follow-up

- Sync the specs and archive the change after the user's review and root checks.
- After the push, add the Notion work log rows for this branch's changes.
