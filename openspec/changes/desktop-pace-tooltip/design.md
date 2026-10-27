# Design

## Context

`PacePanel` draws `paceChartOption(view, money)` through `VChart` (ECharts, set up in `shared/ui`). The option has no
`tooltip`; `TooltipComponent` is already registered. The shared tooltip style is `CHART_TOOLTIP` in
`entities/operations/utils.ts` (rich text on the canvas, placed beside the pointer); the analytics flow chart already
uses it with `trigger: 'axis'`. `PaceView.days` holds only the day number, so the tooltip cannot name the date.

Follows `.agents/project/desktop-renderer.md` (FSD, i18n). Updates none of the `.agents/project/*.md` files.

## Goals / Non-Goals

**Goals:** a per-day tooltip on the pace chart, consistent with the other charts; covered by unit tests on the option.

**Non-Goals:** any change to the chart's look, the figures, or other charts.

## Decisions

- **Axis trigger, shared style.** `tooltip: { ...CHART_TOOLTIP, trigger: 'axis', axisPointer: { type: 'line' } }`. An
  axis trigger reads both lines for the hovered day at once, and works on the usual line although it is `silent`.
  Alternative: item trigger per series — rejected, it would need two hovers to compare.
- **The formatter reads `PaceView`, not the ECharts params.** It takes the hovered index and builds the lines from
  `view.spent[i]`, `view.usual?.[i]` and `view.dates[i]`, so it is a pure function testable without ECharts, and the
  nulls (days after today) are handled in one place. Kept in `features/balances/utils.ts` as `paceTooltip(view, i, money)`.
- **Dates.** `paceView` adds `dates: string[]` (the buckets' `YYYY-MM-DD` keys); the head is `dayMonthName` from
  `shared/lib`. `CHART_TOOLTIP` is imported from `@/entities/operations` (feature → entity is allowed by FSD); if it is not
  exported through the slice's public `index.ts`, it is added there.
- **Texts.** «Spent» reuses `home.balances.pace.spent`. «Usual by now» (`usualByNow`) reads wrong for a past day, so
  the tooltip gets its own keys: `home.balances.pace.tip.usual` («Usual by this day»), `tip.more` and `tip.less` (with
  `{amount}`), in uk, en and ru.

## Risks / Trade-offs

- The tooltip may overlap today's amount pill near the right edge; `besidePointer` flips it left there. Checked on a live
  system only (backlog).
