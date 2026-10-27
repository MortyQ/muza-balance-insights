# Tasks

## 1. Spending ring on ECharts

- [x] 1.1 Register `PieChart` in `shared/ui/components/charts/echarts.ts`; note it in `shared/ui/README.md`; the ECharts bundle test still passes
- [x] 1.2 `ringOf` returns `RingPart[]` (name, value, colour, the list's amount and share; «Other» takes the rest); `RingPart` and the summary `ring` type in `types.ts`; `ringStops` removed
- [x] 1.3 `ringOption(parts)`: a donut over a silent track, `padAngle` (none for one part), rounded ends, `minAngle`, hover `scaleSize`, the tooltip (`CHART_TOOLTIP`, item trigger: name, amount · share); no tooltip with no spending
- [x] 1.4 `CategoryRing.vue`: `VChart` with `ringOption` under the unchanged centre (`pointer-events-none`)
- [x] 1.5 Tests: the parts (several, one, none, a person picked, «Other» as the rest) and the option (gap, rounding, tooltip text); update the tests that read the gradient
- [x] 1.6 `CHANGELOG.md` 0.1.12 entry; `docs/backlog.md`: the ring in both themes, slivers of small categories, the hover not reaching the centre

## 2. Verification

- [x] 2.1 `pnpm test` and `pnpm typecheck` at the root
