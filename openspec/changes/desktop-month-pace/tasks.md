# Tasks

## 1. feat(desktop): month pace data and view

- [x] 1.1 `features/balances/api/usePaceRequest.ts` (`getAnalyticsOverview` for one month, `getAllowanceOverview`) and `composables/useMonthPace.ts` (same month and person as the block, quiet reload on `syncStatus.version`, allowance only for the current month). Verify: `pnpm --filter @mono/desktop typecheck` and `tests/architecture.test.ts` pass
- [x] 1.2 `utils.ts`: `paceView` (cumulative spending, today index, spent / usual by the same day / available per day, `hasUsual`, nothing for a month without data) and `paceChartOption`. Verify: new tests in `tests/renderer/month-pace.test.ts` — running month, past month, no usual, `none` buckets not drawn, «spent» equals the series' last point

## 2. feat(desktop): month pace panel in the balances block

- [ ] 2.1 `components/PacePanel.vue` (title, `VChart`, three figures through `MoneyFormat`, the note without a usual) and its texts as keys in `uk.json`, `en.json`, `ru.json`. Verify: `tests/i18n.test.ts` passes; a component test renders the figures and the note
- [ ] 2.2 `BalancesFeature.vue` layout: beside the month panel from `@[74rem]`, under stack and panel below it, folding with the open row where it is under the stack; `PACE_MIN` and the step in `constants.ts`. Verify: `tests/renderer/balances-block.test.ts` extended — the panel is present, inert while the row is open in the folding wrapper; the card stack's tests unchanged and green

## 3. docs(desktop): month pace rules and changelog

- [ ] 3.1 `.agents/project/desktop-renderer.md` «Блок балансов»: the pace panel, its data and width steps. Verify: the file names `PacePanel` and `@[74rem]`
- [ ] 3.2 `CHANGELOG.md`, `0.1.10 — unreleased`, «Home screen»: the month's pace against a usual month. Verify: `tests/release-notes.test.ts` passes
- [ ] 3.3 `docs/backlog.md`: live check of the three widths and of a past month. Verify: item listed

## 4. Verification

- [ ] 4.1 Run `pnpm test` and `pnpm typecheck` at the root. Verify: both pass
