# Proposal

## Why

On a wide window the balances block shows the folded card stack and the month panel in about 780px, and the rest of
the block stays empty. The card stack stays the block's centrepiece; the free space should answer the block's main
question — am I spending more than usual this month — which home does not answer today.

## What Changes

- The balances block gets a «Month pace» panel: the month's spending added up day by day as a line, against the usual
  month's running spending (dashed), with today's point marked.
- Under the chart, three figures: spent so far (the whole month for a past month), the usual spending by the same day,
  and «Available per day» (the current month only, the planning screen's figure).
- Layout: on a wide block the pace panel sits to the right of the month panel; on a medium block it goes under the
  stack and the month panel; on a narrow one under both. Where it is under the stack it folds away while the row is
  open, as the month panel does. The card stack is not changed.
- Fewer than 3 covered months before the shown one: no usual line, a note says why; the line and «spent so far» stay.
- No data for the month: the panel is not shown.

Out of scope: any change to the card stack, the cards, the open row or the month panel's content; new calculations in
main or core; a pace for a range of months; the analytics screen.

Packages: `apps/desktop` renderer only — the data come from the existing `getAnalyticsOverview` (one month: day
buckets, spending, usual running spending) and `getAllowanceOverview`. No trust anchor changes. User-visible: yes —
`CHANGELOG.md`, `0.1.10 — unreleased`, «Home screen»: the balances block shows the month's pace against a usual month.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `desktop-balance-cards`: the block's layout requirement gains the pace panel (where it sits at each width and when
  it folds), and a new requirement describes what the pace panel shows.

## Impact

- Renderer: `features/balances` (a pace panel component, its request in `api/`, a pure view builder in `utils.ts`, the
  block's layout in `BalancesFeature.vue`, constants for the widths), an ECharts option through `VChart` of `shared/ui`,
  dictionary keys in `uk.json` / `en.json` / `ru.json`.
- Tests: `tests/renderer/balances*.test.ts` and a new test for the pace view.
- Docs: `.agents/project/desktop-renderer.md` («Блок балансов»), `openspec/specs/desktop-balance-cards` via sync.
