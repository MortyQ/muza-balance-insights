# Tasks

## 1. Data process: the bank parts — `feat(desktop): per-bank parts of the category and income answers`

- [x] 1.1 `src/shared/api.ts`: `CategoryOverview.banks` and `IncomeOverview.banks` (design, decision 1), with a doc
      comment each. `src/data/category.ts`: `lineStats` and `incomeStats` count `banks` in their loop, registry order
      then unknown ids. Verify in `tests/category.test.ts`: two banks with spending and a refund give each bank its net
      and purchases; a line without a rate counts nowhere; income gives total and lines per bank; no lines → `[]`.
- [x] 1.2 `src/data/data.ts`: both overviews return `banks`. Verify in `tests/data.test.ts` («a bank view» block,
      fictional mono card and `privatbank:card` file connection): the parts add up to the category's net and to the
      period's income; with `providers` of one bank only that bank is listed; a person's view lists that person's
      banks. Run the desktop checks (`tsc -p tsconfig.node.json`, `vue-tsc -p tsconfig.web.json`, `vitest run`).

## 2. Renderer: the «By bank» card — `feat(desktop): «By bank» card on the category and income screens`

- [ ] 2.1 `entities/operations`: `PartBars`, `PartBar`, `PartView` and `partBars` (design, decision 2); `PeopleBars`
      and `peopleBars` built on them with unchanged props and results. Verify that the existing «Who spent» / «Who
      received» tests in `tests/renderer/category-detail.test.ts` and `income-detail.test.ts` pass unchanged, and add a
      test for `partBars` (positive parts only, scale, order, caption).
- [ ] 2.2 `features/category-detail` and `features/income-detail`: `banksView` in `utils.ts`, `banks` from the view
      composables, the card after «Who spent» / «Who received» with `BankMark` in the slot, and the last-card height
      rule (design, decision 3). Key `entities.operations.banks.title` in `uk.json`, `en.json`, `ru.json`. Verify in
      both screen tests: two banks → the card with two bars, the larger first; one bank, or one bank with a positive
      part → no card; the bank's name and mark shown.
- [ ] 2.3 `CHANGELOG.md`, 0.1.13: an entry after the bank filter's, «See which bank you pay with» — the category and
      income screens split the amount by bank. Flag it to the user for review (it becomes the release text). Run the
      desktop checks.

## 3. Checks

- [ ] 3.1 Add to `docs/backlog.md`, section «Check on a live system: the bank filter», a «By bank» item: with real
      data from two or three banks, the bars add up to the category's and the income's total, and the card at three
      widths and in both themes.
- [ ] 3.2 Run each package's checks (core, mcp, desktop) and report the counts; ask the user to run `pnpm test` and
      `pnpm typecheck` at the root and the desktop build.

## Workflow follow-up

- Sync the specs and archive the change after the user's review and root checks, after `bank-view-filter` is
  archived.
- After the merge, add the block to the Notion work log and cross the item out in the Notion «План розвитку».
