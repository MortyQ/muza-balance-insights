# Tasks

## 1. Core: shares by month and standing

- [x] 1.1 `packages/core/src/read/budget.ts`: `monthShares(income, byCategory, kinds)` → `{ left, wants } | null`
      (whole per cent, null without income), reusing `byKind` and the split's arithmetic
- [x] 1.2 `guideStanding(metric, value)` → `within | near | outside` for left, essential, wants, fixed, debt and the
      reserve; `limitsStanding(over, ahead)`; guides and the 5-point band as constants
- [x] 1.3 Tests in `packages/core/tests/read/budget.test.ts`: the spec's examples (24% / 32%, 18% near, 1.5 months
      outside, limits ahead near), no income, the band's edges
- [x] 1.4 Commit `feat(core): budget shares by month and standing against guides`

## 2. Data: history and payee severity

- [x] 2.1 `src/shared/api.ts`: `InsightsOverview.history`, `severity` on `NewPayeeView` and `OneOffView`
- [x] 2.2 `data/data.ts` `insightsOverview`: `history` from `found`'s months oldest first, plus the shown month when
      finished; empty without a usual; payee and one-off severity by `insightSeverity`
- [x] 2.3 Tests in `tests/data.test.ts` (fictional rows): history order and nulls, a running month left out, severities;
      the canary test still finds no `counter_name`, IBAN or card number
- [x] 2.4 `.agents/project/desktop-import.md`: `getInsightsOverview` carries `history`
- [x] 2.5 Commit `feat(desktop): insights history and payee severity`

## 3. Signals at a glance

- [x] 3.1 `GlanceView.split`; `signalsGlance()` counts every feed item (cards, limits, payees, one-offs)
- [x] 3.2 `InsightsGlance.vue`: the severity bar and labelled counts, no « · »; keys in `uk.json`, `en.json`, `ru.json`
      if a label is new
- [x] 3.3 Renderer tests: 4 / 1 / 12, only low, no usual; commit `feat(desktop): signals by severity at a glance`

## 4. Financial health block

- [x] 4.1 `utils/health.ts`: the chart view (points, gaps, guide, newest value, change in points, text equivalent) and
      the checklist view (seven items, figure, standing, «?» texts moved from `BudgetCard`, header count)
- [x] 4.2 `SharesChart.vue` (`VChart`, dashed guide, the «Left» / «Wants» switch), `HealthChecklist.vue` (income bar,
      items with circle + icon + figure, standing in words for screen readers), `HealthBlock.vue`; remove `BudgetCard.vue`
- [x] 4.3 New texts (block title, switch, standings, «N of M within the guide», «comes when the month ends», «no income»)
      in all three dictionaries
- [x] 4.5 The overview carries `monthlyLimits` (the view's monthly limits and budget) and `standing` (core
      `guideStanding` / `limitsStanding`, computed in the data process: the renderer may not import core's read layer)
- [x] 4.4 Renderer tests: a finished month, a running month, no income, two months of history (no chart), limits over
      and ahead, screen-reader text; commit `feat(desktop): financial health on the Insights screen`

## 5. One feed with filters

- [x] 5.1 `utils/feed.ts`: merge cards, limit cards, new payees and one-offs into `FeedItemView[]` by money; counts by
      severity; filter by severity and kind
- [x] 5.2 `SignalCard.vue` for a payee / one-off; remove `SignalList.vue` and the side column
- [x] 5.3 `useFeedFilter()` (`localStorage` `insights.feedFilter`, try/catch, unknown → all); `FeedFilters.vue` on
      `VToggleGroup`; the empty state with «Reset filters»
- [x] 5.4 Texts for the filter buttons and the empty state in all three dictionaries
- [x] 5.5 Renderer tests: ranking with a one-off first, each filter, both rows, nothing matches → reset, the stored
      choice read back and a bad stored value; commit `feat(desktop): filters on the insights feed`

## 6. Docs and checks

- [x] 6.1 `CHANGELOG.md` under `## 0.1.14 — unreleased`: «Insights: financial health and signal filters»
- [x] 6.2 `docs/backlog.md`: live checks — the chart in both themes and narrow widths, the health block stacked, the
      filter remembered after a restart
- [ ] 6.3 `pnpm test` and `pnpm typecheck` at the root (the user runs them where the sandbox cannot); commit
      `docs: insights-health changelog and live checks`

## 7. Core: references, trend, forecast, new standings

- [x] 7.1 `packages/core/src/read/health.ts` (new, the read layer): `usualOf(shares)` (median of ≥ 3, unusual beyond
      `UNUSUAL_POINTS` = 15), `shareTrend(shares, goodUp)` (last 3 vs up to 3 before, `TREND_POINTS` = 3),
      `leftForecast({ day, days, spent, usual })` from day `FORECAST_FROM_DAY` = 10 with its range
- [x] 7.2 Standings for months in the red, income against the usual, spending against the usual (finished and pace) and
      strong signals, next to `guideStanding` in `read/budget.ts`
- [x] 7.3 Tests in `packages/core/tests/read/health.test.ts` and `budget.test.ts`: the spec's examples, the edges
      (2 months, no income, day 9 / 10); commit `feat(core): usual, trend and forecast of the budget shares`

## 8. Data: the history widened, the forecast, the new items

- [x] 8.1 `history` carries the five shares and their standings; the overview gains `references` (usual, unusual months,
      trends per share), `forecast` (running month: value, range, standing) and the new items' figures and standings
- [x] 8.2 The running month's spending by kind so far comes from the month's own read (no new query); the forecast's
      usual months from `found`
- [x] 8.3 Tests in `tests/data.test.ts`; commit `feat(desktop): health references and the month's forecast`

## 9. Renderer: references on the chart, tiles, a fuller checklist

- [x] 9.1 Chart: the usual line and band, unusual outlines with ▲ / ▼, the hatched forecast bar with its whisker, the
      legend in words
- [x] 9.2 Three tiles above the chart (usual, trend, forecast or the month itself)
- [x] 9.3 Checklist: three groups, the direction beside each share, the four new items with their «?»; «How it was
      counted» says how the forecast is made
- [x] 9.4 New texts in `uk.json`, `en.json`, `ru.json`; renderer tests for each requirement; commit
      `feat(desktop): references and a fuller checklist in financial health`
- [x] 9.5 `CHANGELOG.md` entry widened; `docs/backlog.md`: check the forecast against the month's real end
