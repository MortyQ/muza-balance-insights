# Proposal

## Why

«What's unusual» on home is worked out in the renderer (`features/spending-summary/utils/insights.ts`): the
thresholds, the order and the choice of lines all live in one view function that also writes the text. Nothing else
can reuse it: not the coming Insights page, not the MCP server, not the «Home without empty spots» fallback tile, which
needs to know whether there is anything to show before it picks a tile. The rules themselves also fall short of the
insights spec in Notion («Специфікація: Інсайти»): at most three lines, some lines say the money without the share, and
income is ranked apart from the categories.

## What Changes

- **Detectors in core.** A new `read/insights.ts` in `@mono/core`: pure functions over the shown month's sums and the
  usual month (medians of the whole months before). Each detector returns plain data: `type`, the direction, the
  difference in money (`amount`), the share (`percent`, or none when the usual is too small to divide by), its
  `params` and what a row opens (`link`: the category). No text: the renderer words every insight from i18n keys.
- **Both thresholds.** An insight is kept only when the difference is at least 500 ₴ **and** at least 20% of the
  usual. A category whose usual is under 1 000 ₴ is reported only when it grew, and without a share.
- **Ranked by money, top 5.** All insights, the income one included, are ranked together by the size of the
  difference in money; home shows the first five (three today).
- **Share beside the amount** on every line that has a usual to compare with, including «already more than a usual
  whole month» in a running month.
- **At least 3 whole months.** Fewer than three fully covered months before the shown one → no insights (unchanged
  rule, now owned by core).
- **Rows open their category.** A category insight is a link to the category screen for the shown month.
- **The «Income is at its usual level» line goes.** It is not an insight (nothing is off) and took one of the few
  places; income shows only when it is off by both thresholds.
- **`CHANGELOG.md`**, under `0.1.13 — unreleased`: «What's unusual» lists up to five changes, the biggest in money
  first, each with its share; a row opens its category.

## Capabilities

### New Capabilities
- `core-insight-detectors`: the detectors, their thresholds, ranking and output shape.
- `desktop-unusual-tile`: how the home tile words and shows the detectors' output.

### Modified Capabilities
- None. (`desktop-home-tiles` keeps its «What's unusual tile» requirement — where the tile sits; it is
  not touched.)

## Impact

- `packages/core`: new `src/read/insights.ts`, tests in `tests/read/insights.test.ts`. No migration, no stored data.
- `apps/desktop`: the data process runs the detectors in `spendingOverview` and returns them in a new
  `SpendingOverview.insights` field; the renderer's `insightsView` becomes a mapping from that data to text; the tile
  rows become buttons; i18n keys in `uk.json`, `en.json`, `ru.json`.
- `apps/mcp`: untouched (an MCP tool for insights is a later change).
- Trust anchors: none change.
- User-visible: yes; the `CHANGELOG.md` entry above.

## Out of scope

- The main driver (which operation or payee caused most of the change), positive insights, the «how it was counted»
  hint, the hold handling, P2 detectors (new merchants, a dearer subscription, one-off large operations).
- The Insights page and the «All insights» link.
- The fallback tile when there is nothing unusual («Home without empty spots», the next change).
- A cache of aggregates for 36 months of history.
- Severity levels: with two thresholds and money ranking nothing reads them yet; the Insights page adds them when it
  has a use.
