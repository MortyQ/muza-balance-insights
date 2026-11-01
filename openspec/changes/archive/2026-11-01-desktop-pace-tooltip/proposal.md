# Proposal

## Why

The home «Month pace» chart has no tooltip. To learn how much was spent by a given day, or how far the month is from
usual, the user can only read the axis or the figures under the chart, and the figures only cover today (or the last
day of a past month). Every other chart in the app already has a tooltip.

## What Changes

- Hovering the «Month pace» chart shows a tooltip for the day under the pointer, in the shared chart tooltip style
  (drawn on the canvas, next to the pointer):
  - the date, as «5 October»;
  - «Spent» — the month's spending up to that day (only for days with data);
  - «Usual by this day» — the usual month's spending up to that day (only when the usual month is known);
  - the difference from usual when both are there: «{amount} more than usual» / «{amount} less than usual».
- A thin vertical line marks the hovered day.
- `CHANGELOG.md`, next unreleased version (0.1.12): «The «Month pace» chart shows the spending and the usual for any
  day you point at».

Out of scope:
- the chart library (the chart is already on ECharts) and the chart's look;
- the figures under the chart;
- tooltips on other home charts.

Affected: `apps/desktop` renderer only (`features/balances`, dictionaries). Not affected: `packages/core`, `apps/mcp`,
main, IPC. No trust anchor changes. User-visible: yes (the CHANGELOG entry above).

## Capabilities

### New Capabilities

### Modified Capabilities
- `desktop-balance-cards`: the month pace chart gets a per-day tooltip.

## Impact

- `features/balances/utils.ts`: `paceView` keeps each day's date; `paceChartOption` adds the tooltip.
- `features/balances/types.ts`: `PaceView.dates`.
- Dictionaries uk / en / ru: two keys for the difference.
- Tests: `tests/renderer/month-pace.test.ts`.
