# Tasks

## 1. Month pace tooltip

- [x] 1.1 `PaceView.dates` in `features/balances/types.ts`, filled by `paceView`
- [x] 1.2 `paceTooltip(view, index, money)` in `features/balances/utils.ts`: the date, spent, usual by this day, the difference; lines left out on null
- [x] 1.3 `paceChartOption` adds `tooltip` (`CHART_TOOLTIP`, `trigger: 'axis'`, line pointer) using `paceTooltip`
- [x] 1.4 Keys `home.balances.pace.tip.usual`, `tip.more`, `tip.less` in uk.json, en.json and ru.json
- [x] 1.5 Tests in `tests/renderer/month-pace.test.ts`: the three spec scenarios and the tooltip in the option
- [x] 1.6 `CHANGELOG.md` 0.1.12 entry; `docs/backlog.md`: check the tooltip beside today's pill on a live system

## 2. Verification

- [x] 2.1 `pnpm test` and `pnpm typecheck` at the root
