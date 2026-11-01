## 1. Core rules

- [x] 1.1 `insightSeverity`, `newPayees`, `oneOffs` and their constants in `packages/core/src/read/insights.ts`; tests in `tests/read/insights.test.ts`
- [x] 1.2 Commit `feat(core): severity, new payees and one-offs for insights`

## 2. Data process

- [x] 2.1 `InsightsOverview` types in `api.ts`; channel `getInsightsOverview` (channels, ipc-args, data-protocol + rated, main handler, host, renderer methods)
- [x] 2.2 `DataService.insightsOverview`: month summary, `spendingUsual` with per-category months, all insights with severity, series and drivers, new payees and one-offs from one `linesOfCategories` read
- [x] 2.3 Tests: `tests/data.test.ts` (feed, severity, series, new payee, one-off, too little history, the descriptions canary), `tests/data-queries.test.ts` (fixed statements), `tests/ipc.test.ts` (bad arguments)
- [x] 2.4 Commit `feat(desktop): the insights overview read`

## 3. The screen

- [x] 3.1 Route `insights` with `meta.nav` after «General»; `pages/insights`; `features/insights-page` (api, composable, utils, glance, card, bars, payee lists, basis); i18n keys in `uk.json`, `en.json`, `ru.json`
- [x] 3.2 «All insights» links in home's «Insights» block and «What's unusual» slide
- [x] 3.3 Tests: `tests/renderer/insights-page.test.ts` (glance, feed order and severity, bars, driver, side lists, empty and early states), layouts/nav test updates
- [x] 3.4 Commit `feat(desktop): the «Insights» screen`

## 4. Docs

- [ ] 4.1 `domain-rules.md`, `desktop-renderer.md`, `desktop-import.md`; `CHANGELOG.md` 0.1.13; live checks in `docs/backlog.md`
- [ ] 4.2 Commit `docs: insights screen`

## 5. Verification

- [ ] 5.1 Package tests and typecheck; root `pnpm test` / `pnpm typecheck` by the user
