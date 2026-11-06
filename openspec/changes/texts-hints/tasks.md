# Tasks

## 1. One term: «transaction»

- [x] 1.1 In `uk.json`, `ru.json` and `en.json`, say «транзакція» / «транзакция» / «transaction» wherever a value says
      «операція» / «операция» / «operation» for a bank operation, with full plural forms; headings «Transactions» and
      «Recent transactions»; main's `main.*` texts included
- [x] 1.2 Remove `home.now.opsShort` and `home.spending.opsShort`; their users (`now-strip/utils.ts`,
      `spending-summary/utils/people.ts`, `income-detail/utils.ts`, `entities/operations/utils.ts` `countCaption`)
      take the full plural key
- [x] 1.3 Update the renderer and main i18n tests that read the old words; `tests/i18n.test.ts` stays green
- [x] 1.4 Commit `feat(desktop): one term for a transaction`

## 2. The change rule: money first, «×N» for large changes

- [ ] 2.1 Move `times()` from `entities/goal/utils.ts` to `shared/lib` and use it from there
- [ ] 2.2 `shared/lib/change.ts`: `ratio` on `Change`, `RATIO_FROM` / `RATIO_UNTIL`, the bracket choice in
      `changeText`; unit tests for 9%, ×5.0, ×10 and above, a decrease, «as before» and a new amount
- [ ] 2.3 Give the hint texts that name a base the base amount (category / income chip, «What's unusual», «Today» /
      «This week», the Insights glance), in all three dictionaries
- [ ] 2.4 Update the tests of every change chip user (category, income, spending, unusual, now strip, insights page)
- [ ] 2.5 Commit `feat(desktop): a change says money first`

## 3. Hints

- [ ] 3.1 `MarkView.hint` and a focusable `VTooltip` around a hinted mark in `OperationRow`; the «pending» mark's hint
      on the category and income screens and in «Recent transactions»
- [ ] 3.2 Tooltips on the «Spending» count change («4 fewer transactions than in August»), «… a day», «Compared with
      …» in «Analytics» and «Free» on the balance card
- [ ] 3.3 A «?» with two or three sentences on home's «Balance», «Month pace», «Today» / «This week», «Spending»,
      «Insights», and on «Analytics»' totals, «Income and spending», changes list and category views
- [ ] 3.4 The limits and budget «?» texts say pending holds are left out until the bank finalises them
- [ ] 3.5 Renderer tests: each hint present, keyboard-reachable, the mark's hint read; commit
      `feat(desktop): hints on figures and marks`

## 4. Marks column and wording

- [ ] 4.1 `OperationList`: no «Marks» column (header, cells, grid template) when no shown row has a mark; tests for a
      list without marks and a payee filter that brings one
- [ ] 4.2 «Hide from regular payments», «Not seen in recent months», the category list's empty search state naming
      the search and the scope, in all three dictionaries; tests updated
- [ ] 4.3 Commit `feat(desktop): no empty marks column, clearer wording`

## 5. Docs and checks

- [ ] 5.1 `CHANGELOG.md` `## 0.1.14 — unreleased`: «Clearer words and hints» entry
- [ ] 5.2 `.agents/project/desktop-renderer.md`: a change is said through `changeText`; one term «transaction»
- [ ] 5.3 `docs/backlog.md`: live checks — long plural counts in narrow chips, the hints' popovers at every width and
      both themes, the «Marks» column toggling while filtering
- [ ] 5.4 `pnpm test` and `pnpm typecheck` at the root (the user runs them where the sandbox cannot); commit
      `docs: texts-hints changelog and live checks`
