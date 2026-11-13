# Tasks

## 1. Core: budget exclusions

- [x] 1.1 Migration `v24`: table `goal_excluded (goal_id, category)` with cascade; a taxes row for every budget with
      `count_taxes = 0`; appended to `storage/migrations.ts`; the migration lists in tests
- [x] 1.2 `read/goals.ts`: `BudgetInput.excluded` instead of `countTaxes` — checks (a spending category, once, not a
      fixed row), written and read with the budget, `count_taxes` written as 1 and not read
- [x] 1.3 Core tests: add / update / list / delete with exclusions, the refusals, the migration on a budget saved with
      taxes off, on and before v21
- [x] 1.4 `.agents/project/domain-rules.md`: the budget's exclusions

## 2. Desktop data: flexible spending without the excluded

- [ ] 2.1 `shared/api.ts`, `shared/ipc-args.ts`: `excluded` on the budget payload and view, `countTaxes` removed; the
      schema refuses unknown and repeated ids
- [ ] 2.2 `data/data.ts`, `data/limits.ts`: flexible spending leaves the excluded categories out (pace, forecast,
      per day, pending note, Insights limit signals follow)
- [ ] 2.3 Tests: `tests/data.test.ts` (an excluded category, taxes as one, a limit on an excluded category still
      counts), `tests/ipc.test.ts`

## 3. Budget sheet and the «not counted» note

- [ ] 3.1 `BudgetSheet.vue`: «Exclude from the budget» — the choice and the removable chips; the switch derived from
      the list; fixed-cost choices and `pastFlexible` follow the list
- [ ] 3.2 Budget panel and home's budget slide: «Not counted: …» instead of the taxes note
- [ ] 3.3 Texts in `uk.json`, `en.json` and `ru.json`
- [ ] 3.4 Renderer tests: excluding and taking back, a fixed cost not offered, reopening, the note

## 4. «Budget» in the menu

- [ ] 4.1 The `/budget` route: `meta.nav` between «Regular payments» and «Planning», no `navParent`,
      `periodFilter: 'none'`; the menu text in three dictionaries
- [ ] 4.2 Tests: `tests/renderer/layouts.test.ts` (the entry, its order, current on the screen), home's row still opens it
- [ ] 4.3 `.agents/project/desktop-renderer.md` and `CHANGELOG.md` under 0.1.16

## 5. Checks

- [ ] 5.1 `docs/backlog.md`: check on a live system — the migration on a real budget with taxes off, the sheet with
      several exclusions in both themes
- [ ] 5.2 `pnpm test` and `pnpm typecheck` at the root
