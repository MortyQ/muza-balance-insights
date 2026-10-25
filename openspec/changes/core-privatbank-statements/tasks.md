# Tasks

## 1. Statement kit (core)

- [x] 1.1 `providers/statement-kit.ts` (design 9) with `tests/providers/statement-kit.test.ts`; move the Monobank reader onto it; verify `tests/providers/monobank/statement.test.ts` and the conformance suite pass unchanged

## 2. Category tables and unknown categories (core)

- [x] 2.1 `knowsBankCategory` in `ProviderRules`, `providers/monobank/categories.ts` (empty table); verify conformance and `providers-boundary` tests
- [x] 2.2 «Unknown bank categories» lines in the derivation report (design 8); verify a derivation test with fictional rows and that `apps/mcp/tests/recategorize-safety.test.ts` stays green

## 3. PrivatBank provider and reader (core)

- [x] 3.1 Add `privatbank` to `PROVIDER_IDS`, `providers/privatbank/info.ts` and its line in `PROVIDERS`; verify conformance info checks
- [x] 3.2 `providers/privatbank/statement.ts` (design 2–4), line in `STATEMENT_READERS`; verify with `tests/providers/privatbank/statement.test.ts` (fictional rows: two cards, foreign currency, fee rows, bad date, Excel serial date, trailing empty rows, title-less file)
- [x] 3.3 Conformance fixtures `tests/providers/privatbank/fixtures/conformance/*.document.json` + `*.expected.json`; verify the conformance suite and `purity`, `layers` tests

## 4. PrivatBank rules (core)

- [x] 4.1 `providers/privatbank/categories.ts`, `descriptions.ts`, `rules.ts` (design 5, 8), line in `PROVIDER_RULES`; verify `tests/providers/privatbank/rules.test.ts`
- [x] 4.2 Masking templates (design 6); verify masking cases in `rules.test.ts`
- [x] 4.3 A derivation test: a fictional Monobank debit and PrivatBank credit with a withheld fee pair as a cross-bank transfer, the fee under transfer fees
- [x] 4.4 PrivatBank and the category tables in `.agents/project/core-providers.md` and the «Add a bank» procedure of `.agents/skills/core-architecture`

## 5. Desktop

- [ ] 5.1 `entities/bank/looks/privatbank.ts` and `entities.bank.cardType.privatbank.card` in `uk.json`, `en.json`, `ru.json`; verify `providers.test.ts`, `architecture.test.ts`, `i18n.test.ts`, `renderer/integrations.test.ts`, `renderer/registry-banks.test.ts`
- [ ] 5.2 `CHANGELOG.md` entry under the next unreleased version; `docs/backlog.md`: keep «Real PrivatBank `.xlsx`» open for more files

## 6. Integration

- [ ] 6.1 Run `pnpm test` and `pnpm typecheck` at the root (by the user if the sandbox blocks pnpm)
