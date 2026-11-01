# Tasks

## 1. Category kinds in core

- [x] 1.1 Migration v19 `category_kinds`; `read/category-kinds.ts` (defaults, `categoryKinds(db)` with `changed`); `commands/category-kinds.ts` (`setCategoryKind`, `resetCategoryKinds`, `CategoryKindError`); tests in `packages/core/tests` (defaults, a choice wins, reset one / all, refusals, survives a full re-derivation, the table is not in the analysis whitelist)
- [x] 1.2 Commit `feat(core): category kinds`

## 2. Explanations and the «Categories» section

- [x] 2.1 `shared/ui` `HelpHint` and `IntroNote` (keyboard, screen reader labels, stored dismissal behind try/catch) with tests; listed in `shared/ui/README.md`
- [x] 2.2 Channels `getCategoryKinds`, `setCategoryKind`, `resetCategoryKinds` (channels, ipc-args, data-protocol, main, host, renderer methods); `tests/ipc.test.ts` bad arguments
- [x] 2.3 `entities/category-kind`; `features/category-kinds` with its introduction; `SETTINGS_SECTIONS` + `widgets/settings`; i18n keys in `uk.json`, `en.json`, `ru.json`; `tests/renderer/category-kinds.test.ts` (rows, change, changed mark, reset, failed save reverts, introduction once) and the section order in `tests/renderer/settings.test.ts`
- [x] 2.4 Commit `feat(desktop): the «Categories» section and in-app explanations`

## 3. Budget metrics in core

- [x] 3.1 `read/budget.ts` (`byKind`, `budgetSplit`, `fixedShare`, `debtShare`, `reserveMonths`, guide constants); tests for every spec scenario
- [x] 3.2 Commit `feat(core): budget metrics`

## 4. The «Budget structure» card

- [x] 4.1 `InsightsOverview.budget`; `insightsOverview` fills it (kinds, split, fixed and debt shares, reserve from cards and jars now); `tests/data.test.ts` (finished month, running month, no income, a changed kind moves money) and `tests/data-queries.test.ts` (statement count)
- [x] 4.2 `BudgetCard.vue`, `budgetView`, «?» on every figure with the user's numbers, the introduction, the link to «Categories»; i18n keys in `uk.json`, `en.json`, `ru.json`; tests in `tests/renderer/insights-page.test.ts` (finished, running, no income, no reserve, euro main, an explanation's filled formula, the link)
- [x] 4.3 Commit `feat(desktop): the «Budget structure» card on the Insights screen`

## 5. Limits in core

- [x] 5.1 Migration v20 `goals` and `goal_fixed`; `commands/goals.ts` (save with fixed rows, delete, add suggested; validation and `GoalError`); `read/limits.ts` (`limitState`, `suggestedAmount`, `budgetParts`); tests for every `core-spending-limits` scenario, the unique limit per owner, category and period, and the analysis whitelist
- [x] 5.2 Commit `feat(core): spending limits`

## 6. Limits read and screen

- [x] 6.1 `getLimitsOverview` (types, channels, data process: three period reads per owner view, «Personal» only, every bank, today's rates); `saveGoal`, `deleteGoal`, `addSuggestedLimits` channels; `categoryOverview.limit`; tests in `tests/data.test.ts`, `tests/data-queries.test.ts`, `tests/ipc.test.ts`
- [x] 6.2 `entities/goal`; `features/limits-goals` (budget panel, limit rows sorted by state, empty state with suggestions, `LimitSheet` with the past-months preview, `BudgetSheet` (total, fixed rows added, typed and removed, live result, past months chart, save waits for every amount), delete confirmed in the sheet, introduction, «?» on spent, expected, forecast, per day and state); `pages/budget` + route `/budget` (`meta.navParent: home`, no menu item, `?sheet=budget`); `tests/renderer/layouts.test.ts` (no menu entry, «General» current); `CategoryLimitBar` on the category screen; i18n keys in `uk.json`, `en.json`, `ru.json`
- [x] 6.3 Tests: `tests/renderer/limits-goals.test.ts` (order, states in words, person and family owners, suggestions action, sheet preview, failed save, explanations), the category screen bar
- [x] 6.4 Commit `feat(desktop): limits on the «Budget» screen`

## 7. Limits on home and in insights

- [ ] 7.1 `features/home-budget`: the «Budget» row between home's first and second rows (four parts, wraps on narrow windows, past month result, opens the «Budget» screen) and the empty row with «Set a budget» (no close button, opens the sheet); «Month pace» drops «Available per day» (`useMonthPace` no longer reads the allowance); i18n keys in `uk.json`, `en.json`, `ru.json`; tests in `tests/renderer/home-budget.test.ts` and the month pace tests
- [ ] 7.2 The «Limits» slide in home's highlights tile (attention and exceeded only, first when exceeded, current month only); «limit exceeded» cards in `insightsOverview` and on the Insights screen; i18n keys in `uk.json`, `en.json`, `ru.json`
- [ ] 7.3 Tests: `tests/renderer/home-highlights.test.ts` (three slides, order, no slide when all on track), `tests/data.test.ts` and `tests/renderer/insights-page.test.ts` (the exceeded card)
- [ ] 7.4 Commit `feat(desktop): the budget and limits on home and in the insights feed`

## 8. Savings goals

- [ ] 8.1 `read/savings-goals.ts` (progress from a jar or «cards and jars», needed per month, overdue, a missing jar); tests for every `core-savings-goals` scenario
- [ ] 8.2 Goals in `getLimitsOverview`; `GoalRow`, `GoalSheet` (jar picker offering the jar's target), «?» on progress and need; i18n keys in `uk.json`, `en.json`, `ru.json`; tests in `tests/data.test.ts` and `tests/renderer/limits-goals.test.ts`
- [ ] 8.3 Commit `feat: savings goals`

## 9. Docs

- [ ] 9.1 `domain-rules.md` (kinds, metrics, limits, goals), `desktop-import.md` (channels; goal names are the user's text), `desktop-renderer.md` (section, card, screen, slide, `HelpHint`), root `CLAUDE.md` settings sections list; `CHANGELOG.md` 0.1.13; live checks in `docs/backlog.md` (defaults feel right, guides, pace and forecast early in a month, the reserve with jars, explanations read clearly)
- [ ] 9.2 Commit `docs: budget, limits and goals`

## 10. Verification

- [ ] 10.1 Root `pnpm test` and `pnpm typecheck` pass

## Workflow follow-up

- Archive after merge, then the Notion log row.
