## 1. Core rules

- [ ] 1.1 `mainDriver` and `DRIVER_SHARE` in `packages/core/src/read/insights.ts`: median per payee over the given months (missing = 0), direction of the category's change, share capped at 100, at least 30%, ties by name; tests in `tests/read/insights.test.ts` for growth, a drop, a thin spread and ties
- [ ] 1.2 `savingsRate(now, months)`: the month's rate, the median of months with income, none below 3 such months or without income; tests for a negative rate and too few months
- [ ] 1.3 Commit `feat(core): main driver and savings rate for insights` (core tests and typecheck pass)

## 2. Data process

- [ ] 2.1 `SpendingOverview.explain` in `apps/desktop/src/shared/api.ts` (`HomeInsightDriver`, `SavingsRate`, `InsightBasis`); `spendingUsual` returns the per-month totals and the months it used
- [ ] 2.2 `spendingOverview` builds drivers (one `categoryLines` read per unusual category over the usual months and the shown month, grouped by `merchantKey(merchantText(...))`), the savings rate and the basis; `explain` is null without usual
- [ ] 2.3 Tests in `tests/data.test.ts` with fictional fixtures: a driver found, none under 30%, a past month's savings rate, none for the running month, the basis months and pending holds; the descriptions canary covers the driver name
- [ ] 2.4 Commit `feat(desktop): drivers, savings rate and basis in the spending overview`

## 3. The block

- [ ] 3.1 `features/home-insights` (api, composable, utils, `HomeInsightsTile`, `HomeInsightsFeature`, `index.ts`); keys `home.insights.*` (title, driver row, share, savings line, «spent more than earned», the note with plural months and pending holds) in `uk.json`, `en.json`, `ru.json`
- [ ] 3.2 `SpendingFeature` takes `beside`; `HomePage` mounts `HomeInsightsFeature` after it and passes `beside` from the feature's `visible`
- [ ] 3.3 Tests: `tests/renderer/home-insights.test.ts` (rows and links, savings line only for a past month, the note, hidden without content, follows the scope) and `home-grid.test.ts` / `spending-feature.test.ts` (seven columns beside the block, whole row without it)
- [ ] 3.4 Commit `feat(desktop): the «Insights» block beside «Spending»`

## 4. Docs

- [ ] 4.1 `.agents/project/domain-rules.md` (driver, savings rate), `desktop-renderer.md` (grid, the block), `desktop-import.md` (descriptions in `getSpendingOverview`); `CHANGELOG.md` entry under `0.1.13 — unreleased`; live checks in `docs/backlog.md` (row height beside «Spending», a split payee, a past month)
- [ ] 4.2 Commit `docs: home insights block`

## 5. Verification

- [ ] 5.1 `pnpm test` and `pnpm typecheck` at the root (by the user where the sandbox blocks pnpm)
