# Design

## Context

`CategoryRing.vue` paints the ring as a CSS `conic-gradient` masked to a 14px band, over a sunken track, with the total
in an absolutely placed centre. `ringOf(rows, view, pick)` in `features/spending-summary/utils/ring.ts` turns the list
rows into gradient stops (`ringStops`, 1.4° gaps); «Other» takes the rest of the total so the ring never exceeds it.
A gradient cannot round segment ends or react to the pointer. ECharts is already the app's chart library (`VChart`,
`shared/ui/components/charts/echarts.ts`, only the needed charts registered, tree-shaken for the CSP); `VChart`
resolves CSS colours (`var(--cat)`, `color-mix`) for the canvas. `CHART_TOOLTIP` (`entities/operations`) is the shared
tooltip style.

Follows `.agents/project/desktop-renderer.md` (FSD, "`shared/ui` first", styles) and `desktop-security.md` (the CSP:
no code built from strings). Updates none of them; `shared/ui/README.md` notes the pie chart.

## Goals / Non-Goals

**Goals:** rounded, spaced segments; hover widening and a tooltip; the same data, colours and centre as today.

**Non-Goals:** layout, size, the list, clicks on segments, animation beyond ECharts' default hover.

## Decisions

- **ECharts pie as a donut.** `type: 'pie'`, `radius: ['84%', '100%']` (the 14px band of the 184px ring), `padAngle`
  for the gap, `itemStyle.borderRadius` for the ends, `emphasis.scaleSize` for the hover, `label`/`labelLine` off,
  `startAngle: 90`, clockwise, as the gradient. One part → `padAngle: 0`. The track is a second, silent pie under it in
  `var(--surface-sunken)`. Alternatives: an SVG of arcs with `stroke-linecap: round` — rejected, it would duplicate
  hover and tooltip handling that the chart setup already has; keep the gradient and add an HTML hover map — rejected,
  still no rounded ends.
- **`PieChart` registered in `echarts.ts`** with the others; `tests/echarts-bundle.test.ts` keeps proving the bundle has
  no `new Function`/`eval`.
- **Data, not stops.** `ringOf` returns `RingPart[]` (`{ key, name, value, color, amount, share }`), «Other» still the
  rest; `ringOption(parts)` builds the option. The tooltip formatter reads the part by `dataIndex` and writes
  `name`, then `amount · share` — the list's own formatted strings, so currency and rounding match the list and no
  dictionary key is added. `ringStops` is removed.
- **Centre stays HTML** over the chart (`pointer-events-none`), so its text, chip and currency lines keep their styles.
  The hover scale is kept small (`scaleSize` 4px) so a widened segment never reaches the centre text.
- **Placement:** option builder in `features/spending-summary/utils/ring.ts` (the slice's `utils` segment); the
  component stays `components/summary/CategoryRing.vue`; `VChart` from `@/shared/ui`.

## Risks / Trade-offs

- Hover and tooltip are pointer-only; the category list beside the ring already gives every name, amount and share to
  the keyboard and screen readers, so the ring stays `aria-hidden`.
- Very small categories: `padAngle` plus rounded ends may make a sliver vanish. `minAngle` keeps each segment visible;
  checked on a live system (backlog).
