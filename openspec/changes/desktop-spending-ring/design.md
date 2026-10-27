# Design

## Context

`CategoryRing.vue` paints the ring as a CSS `conic-gradient` masked to a 14px band, over a sunken track, with the total
in an absolutely placed centre. `ringOf(rows, view, pick)` in `features/spending-summary/utils/ring.ts` turns the list
rows into gradient stops (`ringStops`, 1.4° gaps); «Other» takes the rest of the total so the ring never exceeds it.
A gradient cannot round segment ends or react to the pointer. ECharts is already the app's chart library (`VChart`,
`shared/ui/components/charts/echarts.ts`, only the needed charts registered, tree-shaken for the CSP); `VChart`
resolves CSS colours (`var(--cat)`, `color-mix`) for the canvas. `CHART_TOOLTIP` (`entities/operations`) is the shared
tooltip style, but it is drawn on the canvas: on a 184px ring it is clipped by the canvas and covered by the centre
(tried in the first version, see Decisions).

Follows `.agents/project/desktop-renderer.md` (FSD, "`shared/ui` first", styles) and `desktop-security.md` (the CSP:
no code built from strings). Updates none of them; `shared/ui/README.md` notes the pie chart.

## Goals / Non-Goals

**Goals:** rounded, spaced segments; hover widening; the hovered category in the centre; the same data and colours.

**Non-Goals:** layout, size, the list, clicks on segments, animation beyond ECharts' default hover.

## Decisions

- **ECharts pie as a donut.** `type: 'pie'`, `radius: ['84%', '100%']` (the 14px band of the 184px ring), `padAngle`
  for the gap, `itemStyle.borderRadius` for the ends, `emphasis.scaleSize` for the hover, `label`/`labelLine` off,
  `startAngle: 90`, clockwise, as the gradient. One part → `padAngle: 0`. Radii in px (78–92) and the canvas
  `HOVER_GROW` (4px) larger than the ring on every side, so a widened segment is not cut by the canvas edge. The track is a second, silent pie under it in
  `var(--surface-sunken)`. Alternatives: an SVG of arcs with `stroke-linecap: round` — rejected, it would duplicate
  hover and tooltip handling that the chart setup already has; keep the gradient and add an HTML hover map — rejected,
  still no rounded ends.
- **`PieChart` registered in `echarts.ts`** with the others; `tests/echarts-bundle.test.ts` keeps proving the bundle has
  no `new Function`/`eval`.
- **Data, not stops.** `ringOf` returns `RingPart[]` (`{ key, name, value, color, amount, share }`) of the parts with
  spending, «Other» still the rest; `ringOption(parts)` builds the option. Name, amount and share are the list's own
  formatted strings, so currency and rounding match the list and no dictionary key is added. `ringStops` is removed.
- **The hovered category in the centre, not a tooltip.** The first version used the shared canvas tooltip: on this ring
  it was clipped by the canvas and hidden under the centre. A floating HTML tooltip would escape the canvas, but needs
  its own placement at the window's edges and would not match the other charts. The centre is the space the ring
  already has: on hover it shows the category's name, amount and share in place of the label, total and per-day line;
  the change chip under the ring stays. `VChart` gets a `hover` event (`{ seriesIndex, dataIndex } | null`, from
  ECharts' `mouseover`, `mouseout` and `globalout`): a general need of `shared/ui`, not a ring special case.
- **Centre stays HTML** over the chart (`pointer-events-none`), so its text keeps its styles; the track pie is silent and
  sends no hover.
- **Placement:** option builder in `features/spending-summary/utils/ring.ts` (the slice's `utils` segment); the
  component stays `components/summary/CategoryRing.vue`; `VChart` from `@/shared/ui`.

## Risks / Trade-offs

- The hover is pointer-only; the category list beside the ring already gives every name, amount and share to
  the keyboard and screen readers, so the ring stays `aria-hidden`.
- Very small categories: `padAngle` plus rounded ends may make a sliver vanish. `minAngle` keeps each segment visible;
  checked on a live system (backlog).
