# Design

## Context

See proposal.md — Why. The balances block (`features/balances/BalancesFeature.vue`) is a `@container`: from `@[47rem]`
the month panel is absolutely placed at `left: 490px`, up to 340px wide (`STACK_WIDTH`, `PANEL_GAP`, `PANEL_MIN` in
`constants.ts`); narrower it sits under the stack in a `grid-rows` wrapper that folds while the row is open. Its data
come from `useMonthOverview` (`getMonthOverview`, quiet reload on `syncStatus.version`).

`getAnalyticsOverview({ from: month, to: month, participantId })` already returns, for one month, day `buckets` with a
state (`full` / `running` / `none`), `spending` per day (hryvnia kopecks, all scopes, the balances' fold, today's
rates) and `usual` — the usual month's running spending by day, or null with fewer than 3 whole months.
`getAllowanceOverview({ participantId })` returns «Available per day» for now. Both are closed under the lock and while
the database is not ready, like every data channel.

Follows: `.agents/project/desktop-renderer.md` (FSD, `VChart` for charts with pure tested options, i18n, money through
`MoneyFormat`), `desktop-import.md` (the two channels). Updates: `desktop-renderer.md`, «Блок балансов». Not
security-relevant: no new channel, no bank text (both answers carry categories, numbers and dates only).

## Goals / Non-Goals

**Goals:** fill the wide block with a figure that explains the month; reuse existing channels; keep the stack and the
month panel exactly as they are.

**Non-Goals:** a new main calculation; an interactive chart (tooltips per day are welcome but not required); a pace on
the narrow layout's open row.

## Decisions

**Placement (FSD).** Inside `features/balances`, not a new slice: the panel lives in the block's layout and folds with
its row state. `api/usePaceRequest.ts` (both channels), `composables/useMonthPace.ts` (`useAsyncData`, same month and
person as the block, quiet reload on `syncStatus.version`; the allowance only while the month is the current one),
`utils.ts` `paceView(analytics, allowance, money)` → `PaceView` (cumulative series, today index, the three figures,
`hasUsual`), `paceChartOption(view)` (pure, tested), `components/PacePanel.vue` (title, `VChart`, figures, note).
Alternative: a separate `features/month-pace` composed by the home page under the block — it could not share the
block's width steps and fold state without lifting them into the page. Verdict: inside the slice.

**Data.** Reuse `getAnalyticsOverview` rather than a new `MonthOverview` field. Alternative: add `pace` to
`getMonthOverview` in main — a main change, a spec change in `desktop-import.md`, for data that already exist.
Verdict: reuse; two requests on a month change is acceptable (the analytics screen makes the same one).
The cumulative line is summed in the renderer from `spending`; buckets with state `none` are not drawn.

**Widths.** A new step: stack (490) + month panel (340) + gap (24) + pace minimum (320) ≈ 1174px → `@[74rem]`. From
`@[74rem]` the month panel keeps `left: 490px` with a fixed 340px and the pace panel is absolutely placed at
`left: 854px; right: 0`. From `@[47rem]` to `@[74rem]` the pace panel is under the stack and the month panel, in the
same folding `grid-rows` wrapper as the narrow month panel. Below `@[47rem]` it is under both. Constants
`PACE_MIN = 320` and the step are added to `constants.ts`; the Tailwind classes carry them as literals, as the existing
ones do.

**Chart.** ECharts line through `VChart`: the month solid in the primary colour, the usual dashed in a muted colour,
today's point; colours as CSS variables resolved by `VChart`. Axis labels: day numbers only; amounts in the figures, not
on the axis. Under `prefers-reduced-motion` no animation (as the other charts).

## Risks / Trade-offs

- [Two requests per month or person change] → both are cheap aggregates already used elsewhere; quiet reloads keep
  old figures until new ones arrive.
- [«Spent» here vs the month panel's «Out»] → both are the balances' fold over all scopes, so they match; a test
  checks the figure equals the sum of the series.
- [The block gets taller on a medium window] → the pace panel is under the month panel there and folds with the row.

## Migration Plan

None. Rollback = revert the commits.
