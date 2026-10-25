# Design

## Context

Home today (`pages/home/HomePage.vue`) is a column: `BalancesFeature` (one `VCard` holding the stack, the month panel
and the pace panel, placed by container queries and absolute positioning), `NowStripFeature` (one `VCard` with three
cells and a collapsible category list with a «Today / This week» switch), `SpendingFeature` (ring, people list,
category rows, «What's unusual» inside), `RecurringTeaserFeature`. `DefaultLayout` wraps the header and the scroll area
in a rounded `bg-surface` panel. The target look is `.design/home-tiles.html`.

Rules followed: `.agents/project/desktop-renderer.md` (FSD, "`shared/ui` first", styles, home blocks) — updated for the
home grid and the layout; the root `CLAUDE.md` settings-ui block («Layouts», «App navigation») — updated for the
panel's removal. No security-relevant surface is touched.

## Goals / Non-Goals

**Goals:** the tile grid of the mockup with the data and controls home has today; one grid owned by the page; the
open card row and the period details as in-place state changes; no reload of hidden tiles.

**Non-Goals:** new data or IPC; «Recent activity»; trimming the summary card; other screens' content; light theme
colours.

## Decisions

### 1. The page owns one CSS grid; features render tiles with `display: contents` roots

`HomePage` defines a grid with named areas (`bal pace month` / `today week unusual` / `spend spend people` /
`spend spend recurring`) and container-query steps. Each feature keeps one root element, a `contents` wrapper, whose
children are tiles carrying their area class (`[grid-area:bal]` …). So a feature that owns several tiles (balances: 3,
now strip: 2 + details, spending: 3) keeps its state in one place, while the page decides order and columns.

Alternatives: a `widgets/home-grid` that splits each feature into separate components sharing a store — more files and
cross-slice state for no gain; nested grids per feature — cannot interleave tiles of different features in one row
(«What's unusual» belongs to spending but sits in the «Now» row). Verdict: page grid + `contents` roots.

### 2. Breakpoints by the grid's own width

Container query on the grid: ≥ 74rem — three columns as above; 47–74rem — two columns (`bal bal` / `pace month` /
`today week` / `unusual unusual` / `spend spend` / `people recurring`); below — one column in the same order. The
existing `PACE_MIN` / `PANEL_MIN` constants of `features/balances` give way to these steps; the absolute positioning in
`BalancesFeature` goes away.

### 3. Open row: hide neighbours with `v-show` + `inert`, the stack's tile spans the row

When the row opens, the «Balance» tile gets `grid-column: 1 / -1` and the pace and month tiles get `v-show=false` and
`inert`. Kept mounted: the data stays, the chart is not recreated; `VChart`'s resize observer fits the chart when it
is shown again (the `min-w-0` fix of `7eb65ca` stays on the tile). Unmounting would refetch and re-init ECharts on every
fold; opacity-only hiding would leave empty space. Verdict: `v-show` + `inert`.

### 4. Period details: the now strip owns the state, the page hides «What's unusual»

The details tile spans the second row. It lives in `features/now-strip` (its store already keeps `open` and `period`).
«What's unusual» is rendered by `SpendingFeature`; `HomePage` reads the now strip's `open` through the feature's public
API and passes `insights-hidden` to `SpendingFeature`. No feature imports another (FSD).

### 5. Tiles are `VCard`

`VCard padding="md"` already gives the surface, border, radius and shadow; no new `shared/ui` primitive. The category
row of the «Today» style (icon, name, bar, amount) is shared by the now strip's tiles and details: a component inside
`features/now-strip`. Spending keeps its own `CategoryRow` restyled to the same look; a shared row is not extracted now
(two slices, different data shapes).

### 6. Layout: no panel, a scroll-aware header

`DefaultLayout` loses the panel classes; the header row gets `bg-background` and a bottom border shown while the scroll
area's `scrollTop > 0` (a small composable in `app/layouts/composables`).

### 7. Category icons in the now strip

The now strip's rows carry a colour but no icon. The icon comes from the same category → icon source the spending rows
use; if the now strip's answer lacks the category id for some row («other»), the row shows a neutral dot.

## Risks / Trade-offs

- `display: contents` drops the wrapper from the accessibility tree; each tile keeps its own `section` and label, so the
  structure stays readable. Focus order follows DOM order, which matches the grid order.
- Equal row heights stretch a short tile («Today» with one category); its button is pushed to the bottom, as in the
  mockup.
- Moving «What's unusual» out of the spending block changes where users find it; noted in the changelog.
- Live checks (two-column step, chart refit after the open row, scroll hairline, both themes) go to `docs/backlog.md`.
