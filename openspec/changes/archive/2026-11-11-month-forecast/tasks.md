# Tasks

## 1. Data

- [x] 1.1 `data/forecast.ts` (pure: per-day figures without regular payments, quartiles, the forecast) and `insightsOverview` → `InsightsOverview.forecast` from `findRecurring` with the screen's scope; verify `tests/forecast.test.ts` (formula, no double count, range order, null) and `tests/data.test.ts` (running month, past month null, no usual null)

## 2. Screen

- [x] 2.1 `forecastGlance` in `features/insights-page/utils`, `InsightsGlance` with the range and the «?»; keys in `uk.json`, `en.json`, `ru.json`; verify `tests/renderer/insights-page.test.ts` (figure, range, formula, «Show also», absent for a past month)
- [x] 2.2 `CHANGELOG.md` «### Insights» line (flagged for human review); `docs/backlog.md` live check; `.agents/project/desktop-import.md` and `desktop-renderer.md` lines

## 3. Checks

- [x] 3.1 Each package's typecheck and tests; the user runs `pnpm test` and `pnpm typecheck` at the root
