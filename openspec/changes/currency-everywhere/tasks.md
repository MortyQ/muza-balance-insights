# Tasks

## 1. The amount part

- [x] 1.1 Add `MoneyStack` to `entities/currency-display` (export from its `index.ts`) and `alsoFor` to `MoneyFormat` (`utils.ts`); move `AmountCell` of `features/spending-summary` onto it; verify a renderer test of `MoneyStack` (no line without a pick, one line per pick, the exact line for an operation in a picked currency) and the spending tests pass

## 2. Transaction rows

- [x] 2.1 `OperationRow` shows `also` through `MoneyStack`, `original` only for a currency neither main nor picked; fill `also` in `features/category-detail/utils.ts` and `features/income-detail/utils.ts`, and the list total; verify the category and income renderer tests with hryvnia picked and euros main

## 3. Category and income screens

- [x] 3.1 «Who spent» (`PeopleBars`), the payee list (`ShareList`), the split by bank and by part of day, the summary stats get `also`; tooltips of the day and month bars get `approxInline`; verify the category and income tests

## 4. Home

- [x] 4.1 Recent transactions, the «Limits» slide and the budget row get `also`; verify the home tests

## 5. Planning

- [x] 5.1 Limit and goal rows, the budget panel, regular payment rows, «Available per day» rows get `also`; verify the limits-goals, recurring and allowance tests

## 6. Analytics and Insights

- [x] 6.1 Analytics list rows and chart tooltips, Insights cards and the health tooltips get `also` / `approxInline`; verify the analytics and insights tests

## 7. Changelog and checks

- [x] 7.1 Add the «### Currencies» entry under `## 0.1.15 — unreleased` in `CHANGELOG.md` (flagged for human review); add to `docs/backlog.md`: dense lists with two picked currencies, both themes
- [x] 7.2 Run the desktop typecheck and vitest from `apps/desktop`; ask the user to run `pnpm test` and `pnpm typecheck` at the root

## Workflow follow-up

- The user checks each area in the app with one and two «Show also» currencies.
- Sync the spec and archive the change once it is committed.
