# Tasks

## 1. Category rules version and transport MCCs

- [x] 1.1 `packages/core/src/derive/categories.ts`: map MCC 4111 and 4789 to `CATEGORY.transport`; add `CATEGORY_RULES_VERSION = 2` with a comment saying when to bump it
- [x] 1.2 `derive/rederive.ts`: `rederiveCore` records the version under `derived_state` key `category_rules`; export `rulesChanged(db)` (a missing row reads as version 1)
- [x] 1.3 Full pass on a new version: the end of an import in `apps/desktop/src/worker/run-import.ts` and the upload in `packages/core/src/ingest/statement-import.ts` add `rulesChanged` to their full-pass conditions
- [x] 1.4 Tests:
  - `tests/derive`: 4111 and 4789 → transport; a manual or payee category still wins;
  - `rulesChanged` before and after `rederiveCore`;
  - `apps/desktop/tests`: the worker runs `rederiveCore` once on an old version and spans the next time;
  - the upload does the same
- [x] 1.5 `.agents/project/domain-rules.md`: the rules version and when to bump it. `CHANGELOG.md` `## 0.1.14 — unreleased`: commuter transport and transport services are now «Taxi and transport»

## 2. Pending holds as a spending filter (core)

- [x] 2.1 `read/filters.ts`: `holds?: 'all' | 'final' | 'pending'` in `SpendingFilters`, validated; `read/spending.ts`: `spendingLinesSql` takes `nowSec` and applies it with the `RESYNC_OVERLAP_SEC` window; every caller passes `nowSec`
- [x] 2.2 Tests in `tests/read`:
  - `'final'` leaves out today's hold and keeps a 5-day-old one;
  - `'pending'` returns only the fresh ones, with their commissions;
  - `'all'` equals today's numbers;
  - the bench is run and compared with `bench/budgets.ts`
- [x] 2.3 `.agents/project/domain-rules.md`: limits and the Insights month count without pending holds

## 3. Limits, budget and Insights without pending holds (desktop)

- [x] 3.1 `apps/desktop/src/data/data.ts`:
  - `limitsOverview` reads its grids with `holds: 'final'`, and a `'pending'` grid for the counts and amounts per owner and period;
  - `limitsOverOf` and the Insights and home «What's unusual» month read use `'final'`;
  - `shared/api.ts`: `pending: { count, amount } | null` on `LimitFiguresView`
- [x] 3.2 `apps/desktop/src/data/limits.ts`: `limitView` and `budgetView` carry the pending figures (the budget's from its flexible categories)
- [x] 3.3 `entities/goal/components/PendingNote.vue`: «+ N pending, X» with its tooltip; shown on the «Budget» screen (budget and limits), home's «Budget» row and the category screen's limit bar; keys in `uk` / `en` / `ru`
- [x] 3.4 `features/insights-page`: the «How it was counted» note says pending holds are left out and how many; keys in three languages
- [x] 3.5 Tests:
  - `apps/desktop/tests`: a hold from today leaves a limit's spent amount and no «Limit exceeded» card, and is in `pending`;
  - renderer tests for the note on the three places and for its absence without holds
- [x] 3.6 `CHANGELOG.md`: pending payments no longer count towards limits, the budget and Insights until the bank finalises them

## 4. «Forecast above the limit» in the Insights feed

- [x] 4.1 `data.ts`: `limitsOverOf` → `limitSignalsOf` returning `limitsOver` and `limitsAhead` (current month only, by `limitState`, not exceeded, forecast counted); `shared/api.ts`: `LimitAheadView` and `limitsAhead` on the overview
- [x] 4.2 `features/insights-page/utils.ts`: `limitAheadCard` (forecast, overrun, per day, link to «Budget»), merged into the feed by the overrun; `calm` also checks `limitsAhead`; keys in three languages
- [x] 4.3 Tests:
  - day 10 of 30 with 1 900 of 4 000 gives a card: 5 700 forecast, 1 700 over, 100 a day;
  - nothing on day 5;
  - an exceeded limit gives only «Limit exceeded»;
  - a past month gives none;
  - the feed order with other cards
- [x] 4.4 `CHANGELOG.md`: «Forecast above the limit» in Insights

## 5. «Count taxes» in the monthly budget

- [ ] 5.1 `packages/core/src/storage/migrations/v21.ts`: `goals.count_taxes` (default 1, CHECK 0/1), with a comment saying why; appended to `storage/migrations.ts`
- [ ] 5.2 `read/goals.ts`: `countTaxes` on `BudgetInput`, read and written; refuse a taxes fixed row while it is false
- [ ] 5.3 `apps/desktop/src/data/limits.ts`:
  - `budgetView` leaves taxes out of the flexible words while it is off;
  - the IPC goal input accepts `countTaxes` (`ipc-args.ts`), defaulting to true
- [ ] 5.4 `features/limits-goals`, the budget sheet:
  - the «Count taxes» switch with its hint;
  - off: drops taxes from the preview and from «Add a fixed cost» choices, and removes a listed taxes row;
  - the «Budget» screen says when taxes are not counted;
  - keys in three languages
- [ ] 5.5 Tests:
  - core: the migration, a refusal, an old budget reading `countTaxes: true`;
  - desktop: the flexible part without taxes, while «Spending» and 50/30/20 keep them;
  - the sheet's behaviour
- [ ] 5.6 `CHANGELOG.md`: a budget can leave taxes out

## 6. Cash withdrawals switch

- [ ] 6.1 `people/settings.ts`: the key `cash_is_spending` (default true)
- [ ] 6.2 `read/spending.ts`:
  - `spendingLinesSql` reads it and, while off, excludes the cash body as an internal transfer's (the commission line stays);
  - `cashWithdrawn(db, q, nowSec)` returns the net withdrawn per currency
- [ ] 6.3 Tests in `tests/read`:
  - off removes cash from summary, grid, category lines and by person and by bank, and keeps the commission;
  - on equals today;
  - `cashWithdrawn`;
  - the bench again
- [ ] 6.4 Desktop data and IPC:
  - `cashCounts` / `setCashCounts` (the change event refreshes the read cache);
  - the month block's read gets `cashWithdrawn` (null while on);
  - the limit sheet does not offer «Cash» while off
- [ ] 6.5 Renderer:
  - `features/settings/category-kinds`: the switch with its hint and the «not counted» mark on «Cash»;
  - `features/balances`: «Withdrawn in cash» with its tooltip;
  - `features/insights-page`: the note says cash is left out;
  - keys in three languages
- [ ] 6.6 Tests:
  - renderer: the switch, a failed save returning it, the figure shown only while off;
  - `apps/mcp`: the spending tool without cash while off
- [ ] 6.7 `.agents/project/domain-rules.md`: the cash switch, MCP included. `CHANGELOG.md`: cash withdrawals can be left out of spending in «Categories»

## 7. Wrap-up

- [ ] 7.1 `docs/backlog.md`, «To check live: figure accuracy»:
  - a real hold leaving a limit and coming back once final;
  - the first import after the update running one full pass;
  - the cash switch across home, Analytics and Insights;
  - a budget without taxes
- [ ] 7.2 Run `pnpm test` and `pnpm typecheck` at the root (where the sandbox cannot, run each package from its folder and ask the user to run the root commands)
