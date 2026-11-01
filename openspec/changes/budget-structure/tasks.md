# Tasks

## 1. Category kinds in core

- [ ] 1.1 Migration v19 `category_kinds`; `read/category-kinds.ts` (defaults for every kind-bearing category, `categoryKinds(db)` with `changed`); `commands/category-kinds.ts` (`setCategoryKind`, `resetCategoryKinds`, `CategoryKindError`); tests in `packages/core/tests` (defaults, a choice wins, reset one / all, refusals, survives a full re-derivation, not in the analysis copy whitelist)
- [ ] 1.2 Commit `feat(core): category kinds`

## 2. Budget metrics in core

- [ ] 2.1 `read/budget.ts`: `byKind`, `budgetSplit`, `fixedShare`, `debtShare`, `reserveMonths`, guide constants; tests for the spec scenarios (within guide, spent more than earned, no income, reserve absent under 3 months or zero median)
- [ ] 2.2 Commit `feat(core): budget metrics`

## 3. Data process and channels

- [ ] 3.1 `InsightsOverview.budget` and `CategoryKindView` types in `api.ts`; `insightsOverview` fills `budget` (kinds, month split, fixed and debt shares, reserve from cards and jars now); channels `getCategoryKinds`, `setCategoryKind`, `resetCategoryKinds` (channels, ipc-args, data-protocol, main, host, renderer methods)
- [ ] 3.2 Tests: `tests/data.test.ts` (budget of a finished month, a running month, no income, a changed kind moves money), `tests/data-queries.test.ts` (statement count), `tests/ipc.test.ts` (bad arguments)
- [ ] 3.3 Commit `feat(desktop): budget in the insights read and category kind channels`

## 4. The «Categories» section

- [ ] 4.1 `entities/category-kind`; `features/category-kinds`; `SETTINGS_SECTIONS` + `widgets/settings` map; i18n keys in `uk.json`, `en.json`, `ru.json`
- [ ] 4.2 Tests: `tests/renderer/category-kinds.test.ts` (rows, change, changed mark, reset, failed save reverts), section order in `tests/renderer/settings.test.ts`
- [ ] 4.3 Commit `feat(desktop): the «Categories» section`

## 5. The «Budget» card

- [ ] 5.1 `BudgetCard.vue`, `budgetView` in `features/insights-page/utils.ts`, first in the side column; link to the section; i18n keys in `uk.json`, `en.json`, `ru.json`
- [ ] 5.2 Tests in `tests/renderer/insights-page.test.ts` (finished month, running month, no income, no reserve, euro main, the link)
- [ ] 5.3 Commit `feat(desktop): the «Budget» card on the Insights screen`

## 6. Docs

- [ ] 6.1 `domain-rules.md` (kinds, metrics), `desktop-import.md` (channels), `desktop-renderer.md` (section, card), root `CLAUDE.md` settings sections list; `CHANGELOG.md` 0.1.13; live checks in `docs/backlog.md` (defaults feel right, guides, reserve with jars)
- [ ] 6.2 Commit `docs: budget structure`

## 7. Verification

- [ ] 7.1 Root `pnpm test` and `pnpm typecheck` pass

## Workflow follow-up

- Archive after merge, then the Notion log row.
