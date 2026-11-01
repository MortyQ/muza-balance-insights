# Tasks

## 1. Core: detectors (core)

- [x] 1.1 `read/insights.ts`: `InsightInput`, `Insight`, the constants and `detectInsights` (design 1–3). Verify with
  fictional sums in `tests/read/insights.test.ts`: both thresholds, rare and new categories, running month, income,
  ranking with ties, fewer than 3 months.

## 2. Desktop: data process and contract (desktop)

- [x] 2.1 `SpendingOverview.insights` in `shared/api.ts`; `spendingOverview` calls `detectInsights` with its folded sums
  and adds `categoryId` (design 4). Verify in `tests/data.test.ts`.

## 3. Desktop: the tile (desktop)

- [x] 3.1 `insightsView` maps the detectors' output to lines; constants moved; `INSIGHT_MAX` = 5; category rows link to
  the category screen; keys in `uk.json`, `en.json`, `ru.json` (`overMonth` with `{diff}`, `incomeNormal` removed). Renderer tests,
  including a mounted click on a line.
- [x] 3.2 `CHANGELOG.md` entry under `0.1.13 — unreleased`.

## 4. Docs and checks

- [x] 4.1 `.agents/project/domain-rules.md` (an «Insights» bullet), `docs/backlog.md` (five lines in the tile, checked
  live).
- [ ] 4.2 `pnpm test` and `pnpm typecheck` at the root (by the user where the sandbox blocks pnpm).
