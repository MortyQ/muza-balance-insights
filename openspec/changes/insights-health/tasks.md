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

- [ ] 4.1 `utils/health.ts`: the chart view (points, gaps, guide, newest value, change in points, text equivalent) and
      the checklist view (seven items, figure, standing, «?» texts moved from `BudgetCard`, header count)
- [ ] 4.2 `SharesChart.vue` (`VChart`, dashed guide, the «Left» / «Wants» switch), `HealthChecklist.vue` (income bar,
      items with circle + icon + figure, standing in words for screen readers), `HealthBlock.vue`; remove `BudgetCard.vue`
- [ ] 4.3 New texts (block title, switch, standings, «N of M within the guide», «comes when the month ends», «no income»)
      in all three dictionaries
- [ ] 4.4 Renderer tests: a finished month, a running month, no income, two months of history (no chart), limits over
      and ahead, screen-reader text; commit `feat(desktop): financial health on the Insights screen`

## 5. One feed with filters

- [ ] 5.1 `utils/feed.ts`: merge cards, limit cards, new payees and one-offs into `FeedItemView[]` by money; counts by
      severity; filter by severity and kind
- [ ] 5.2 `SignalCard.vue` for a payee / one-off; remove `SignalList.vue` and the side column
- [ ] 5.3 `useFeedFilter()` (`localStorage` `insights.feedFilter`, try/catch, unknown → all); `FeedFilters.vue` on
      `VToggleGroup`; the empty state with «Reset filters»
- [ ] 5.4 Texts for the filter buttons and the empty state in all three dictionaries
- [ ] 5.5 Renderer tests: ranking with a one-off first, each filter, both rows, nothing matches → reset, the stored
      choice read back and a bad stored value; commit `feat(desktop): filters on the insights feed`

## 6. Docs and checks

- [ ] 6.1 `CHANGELOG.md` under `## 0.1.14 — unreleased`: «Insights: financial health and signal filters»
- [ ] 6.2 `docs/backlog.md`: live checks — the chart in both themes and narrow widths, the health block stacked, the
      filter remembered after a restart
- [ ] 6.3 `pnpm test` and `pnpm typecheck` at the root (the user runs them where the sandbox cannot); commit
      `docs: insights-health changelog and live checks`
