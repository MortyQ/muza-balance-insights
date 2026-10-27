# Tasks

## 1. Spending ring on ECharts

- [x] 1.1 Register `PieChart` in `shared/ui/components/charts/echarts.ts`; note it in `shared/ui/README.md`; the ECharts bundle test still passes
- [x] 1.2 `ringOf` returns `RingPart[]` (name, value, colour, the list's amount and share; «Other» takes the rest); `RingPart` and the summary `ring` type in `types.ts`; `ringStops` removed
- [x] 1.3 `ringOption(parts)`: a donut over a silent track, `padAngle` (none for one part), rounded ends, `minAngle`, hover `scaleSize`
- [x] 1.3a Radii in px and the canvas `HOVER_GROW` larger than the ring, so the widened segment is not cut
- [x] 1.3b `VChart` emits `hover` (`{ seriesIndex, dataIndex } | null`); the test chart recorder can fire it
- [x] 1.3c `CategoryRing.vue`: the hovered part's name, amount and share in the centre, the total back on leaving; no tooltip in the option
- [x] 1.4 `CategoryRing.vue`: `VChart` with `ringOption` under the unchanged centre (`pointer-events-none`)
- [x] 1.5 Tests: the parts (several, one, none, a person picked, «Other» as the rest), the option (gap, rounding, no tooltip), the centre swapping on hover; update the tests that read the gradient
- [x] 1.6 `CHANGELOG.md` 0.1.12 entry; `docs/backlog.md`: the ring in both themes, slivers of small categories, the hover not reaching the centre

## 2. Verification

- [x] 2.1 `pnpm test` and `pnpm typecheck` at the root
