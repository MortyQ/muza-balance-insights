# Tasks

## 1. Data

- [ ] 1.1 `incomeOverview` adds `regular` from core `findRecurring({ kind: 'income' })` over 13 months and the active regular payments' monthly sum; verify `tests/data.test.ts` (late, changed, none, covered share) with a canary for bank text beyond the sender name

## 2. Screen

- [ ] 2.1 `RegularIncomeHeader`, `RegularSources`, `ExpectedIncome` in `features/income-detail` with pure view functions; keys in `uk.json`, `en.json`, `ru.json`; verify `tests/renderer/income-detail.test.ts`
- [ ] 2.2 `CHANGELOG.md` «### Income» line (flagged for human review); `docs/backlog.md` live check

## 3. Checks

- [ ] 3.1 Each package's typecheck and tests; the user runs `pnpm test` and `pnpm typecheck` at the root
