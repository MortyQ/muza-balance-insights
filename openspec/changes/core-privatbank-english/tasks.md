# Tasks

## 1. English reader (core)

- [x] 1.1 `providers/privatbank/statement.ts`: a per-language table (title pattern, column regexes) and two readers built from the same layout code, `privatbank-card-uk` (unchanged) and `privatbank-card-en`, both in `readers` (design 1); verify `tests/providers/privatbank/statement.test.ts` gains English cases (fictional rows: title and title-less, two cards, foreign currency, fee on a debit and withheld on a credit, trailing empty rows), each reader scoring 0 on the other language's file
- [x] 1.2 Conformance fixtures `tests/providers/privatbank/fixtures/conformance/card-en.document.json` + `card-en.expected.json` (fictional data, the `Statement` sheet); verify the conformance suite (picked by the document alone, `detect` 0 on every other bank's fixture) and the `purity`, `layers`, `providers-boundary` tests

## 2. English categories and service texts (core)

- [ ] 2.1 `categories.ts`: the English names of design's table in `BANK_CATEGORIES` and the five English transfer categories in `TRANSFER_CATEGORIES` (design 2); verify `rules.test.ts` cases for an English purchase, an English transfer and an unknown English category
- [ ] 2.2 `descriptions.ts` and `rules.ts`: the English own-card, jar, cash and «from» texts; `namedSender` returns the text's own label (design 3); verify `rules.test.ts` cases for each, own transfer and income source included
- [ ] 2.3 Masking: the four English templates kept, «from …» masked to `[other]` with `from_prefix` (design 4); verify masking cases in `rules.test.ts` and that `apps/mcp/tests/analysis.test.ts` stays green

## 3. Docs

- [ ] 3.1 `.agents/project/core-providers.md`, PrivatBank section: both readers and languages
- [ ] 3.2 `CHANGELOG.md` 0.1.10: the PrivatBank entry says Ukrainian or English, drops Russian
- [ ] 3.3 `docs/backlog.md`: English names of unseen PrivatBank categories; whether English treasury payees are transliterated

## 4. Integration

- [ ] 4.1 Run `pnpm test` and `pnpm typecheck` at the root (by the user if the sandbox blocks pnpm)
