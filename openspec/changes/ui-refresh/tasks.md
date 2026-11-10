# Tasks

## 1. Shared parts

- [ ] 1.1 Add `VIconDisc`, `VBadge`, `VStat`, `VEmptyState`, `VListRow` and `VSkeleton` to `shared/ui` (Tailwind, no `<style>`), export them from `shared/ui/index.ts`; verify with `tests/renderer/ui-parts.test.ts` (sizes, tones, slots, `as` component, dark tone classes, skeleton `role="status"`)
- [ ] 1.2 Add `VCount` (right-aligned digit columns, first value without motion, no roll under reduced motion or without `matchMedia`, `textContent` equals the value at rest, value as accessible text once); verify with `tests/renderer/count.test.ts` with `matchMedia` stubbed both ways
- [ ] 1.3 Add the `text-title` / `text-subtitle` utilities to `app/styles/main.css`; verify the renderer build (`vue-tsc` and the vitest run) is clean
- [ ] 1.4 Add the new files to the own-file list of `tests/ui.test.ts` and a row per part in `shared/ui/README.md` (Tailwind for new parts, SCSS for copies); add the «Shared marks» rule to `.agents/project/desktop-renderer.md`; verify `tests/ui.test.ts` passes

## 2. Entities and shared marks

- [ ] 2.1 Move `LimitStateChip` onto `VBadge` (`STATE_LOOK.chip` → a tone), `SummaryCard`'s pill and `SummaryFigure` onto `VStat`; switch the limit chip tests to `data-tone`; verify `tests/renderer` for goal and operations pass
- [ ] 2.2 Rebuild `DetailSkeleton` on `VSkeleton` with the same outline; verify the category, income, analytics, insights and limits screens' tests pass

## 3. Home

- [ ] 3.1 Move «Now» (`NowStripFeature`, `TileCategories`), «Spending» (`CategoryRow`, `SpendingInsights`), the highlights tile (`RecentOperationsList`, `HomeInsightsTile`, `LimitsSlide`) and the budget block (`HomeBudgetFeature`) onto `VIconDisc`, `VBadge`, `VStat`, `VListRow`, `VEmptyState` and the title utilities; headline figures through `VCount`; verify the home renderer tests pass unchanged in texts and `data-test`
- [ ] 3.2 Add block skeletons (`<Block>Skeleton.vue` in each home feature's `components/`) shown only while loading without a view; verify a test per block that the skeleton shows on loading and not when the read cache answers
- [ ] 3.3 Open new recent-transaction and limit rows with `VCollapse`; verify the highlights tests pass

## 4. Analytics and insights

- [ ] 4.1 Move `AnalyticsFeature` (`ChangesList`, `SmallChartsView`), `InsightsFeature` (`InsightCard`, `SignalCard`, `HealthChecklist`, `SharesChart`) onto the shared parts; severity chips through `VBadge` tones; verify the analytics and insights tests pass

## 5. Planning screens

- [ ] 5.1 Move limits and goals (`LimitsGoalsFeature`, `LimitRow`, `BudgetPanel`), regular payments (`RecurringFeature`, `RecurringRow`, `RecurringSummary`) and the daily allowance (`AllowanceFeature`, `ReserveList`) onto the shared parts; verify their renderer tests pass

## 6. Category and income screens

- [ ] 6.1 Move the category and income screens' rows and pickers (`CategoryPicker`, the `entities/operations` lists) onto `VListRow` and `VIconDisc`; verify their tests pass

## 7. Settings and «People and banks»

- [ ] 7.1 Move `ConnectionRow`, `BankPicker`, `PersonBlock`, `CategoryKindRow` (its `VLoader` → skeleton) and `StorageInfoFeature` onto `VBadge`, `VIconDisc` and `VSkeleton`; verify `tests/renderer/settings.test.ts` and the integrations tests pass

## 8. Changelog and checks

- [ ] 8.1 Add the «### Look» entry under `## 0.1.15 — unreleased` in `CHANGELOG.md` (flagged for human review before the release); add to `docs/backlog.md` what only the running app shows (both themes per area, rolling on month / person / currency change, reduced motion)
- [ ] 8.2 Run `pnpm test` and `pnpm typecheck` at the root (in the sandbox: each package from its folder, the root run by the user)

## Workflow follow-up

- The user checks each area in the app in both themes.
- Sync the spec and archive the change once it is committed.
- Add the Notion work-log row once pushed.
