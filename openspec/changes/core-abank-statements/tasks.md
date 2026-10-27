# Tasks

## 1. Credit limit of a statement (core)

- [x] 1.1 `creditLimit?: number | null` on `ParsedStatement`; `ingest/statement-import.ts` stores it on a new account
  and with the newer balance (design 7). Verify with a statement-import test using fictional rows: a new account, a
  newer statement, an older one, and one without a limit. Verify that the existing readers' tests and the conformance
  suite pass unchanged.

## 2. Statement kit: amounts and PDF tables (core)

- [ ] 2.1 `localAmount`, `pdfLines` and `pdfTable` in `providers/statement-kit.ts` (design 6). Verify with
  `tests/providers/statement-kit.test.ts`, using fictional items:
  - a three-line row;
  - a wrapped description;
  - a header repeated on page 2;
  - right-aligned and centred cells;
  - page headers and footers ignored;
  - amounts with each kind of space and as stored numbers.

## 3. A-Bank provider and readers (core)

- [ ] 3.1 Add `abank` to `PROVIDER_IDS`, `providers/abank/info.ts` and its line in `PROVIDERS` (design 1). Verify the
  conformance info checks.
- [ ] 3.2 `providers/abank/statement.ts`: the column spec, the spreadsheet reader and the PDF reader (design 2–5), and
  the line in `STATEMENT_READERS`. Verify with `tests/providers/abank/statement.test.ts`, using fictional rows:
  - two cards on one IBAN;
  - a row with `-` as its card;
  - a USD purchase;
  - a withdrawal with a fee;
  - an empty MCC;
  - cashback `-` and negative;
  - an Excel serial date and numeric cells;
  - a header-only file (detect 1);
  - a credit limit in another currency (bad-row);
  - a PDF over two pages, and a PDF without an IBAN.
- [ ] 3.3 Conformance fixtures `tests/providers/abank/fixtures/conformance/*.document.json` + `*.expected.json`: an
  xlsx, a pdf and a bad-row case. The layout follows the masked analysis and every value is fictional. Verify the
  conformance suite and the `purity`, `layers` and `providers-boundary` tests.

## 4. A-Bank rules (core)

- [ ] 4.1 `providers/abank/categories.ts` (empty), `descriptions.ts` and `rules.ts` (design 8), and the line in
  `PROVIDER_RULES`. Verify `tests/providers/abank/rules.test.ts`: transfer, cashback, the 6012 credit, «Скасування.»,
  the prefix-less refund, `MONO*` and a purchase.
- [ ] 4.2 Masking templates (design 9, after the user's ok in review). Verify the masking cases in `rules.test.ts`.
- [ ] 4.3 Derivation tests on fictional rows:
  - a Monobank debit and an A-Bank `MONO*` credit pair as a cross-bank transfer;
  - a cancelled purchase is a refund;
  - the cashback credit is income and stays unpaired.
- [ ] 4.4 Update `.agents/project/core-providers.md` (A-Bank, a statement's credit limit) and the «Add a bank»
  procedure of `.agents/skills/core-architecture` (the PDF helpers).

## 5. Desktop

- [ ] 5.1 `entities/bank/looks/abank.ts` (design 10) and `entities.bank.cardType.abank.card` in `uk.json`, `en.json`
  and `ru.json`. Verify `providers.test.ts`, `architecture.test.ts`, `i18n.test.ts`, `renderer/integrations.test.ts`
  and `renderer/registry-banks.test.ts`.
- [ ] 5.2 `CHANGELOG.md`, 0.1.12 — unreleased: «A-Bank: add an A-Bank card from its statement (.xlsx or .pdf)».
- [ ] 5.3 `docs/backlog.md`: a «Real A-Bank files» item replacing the A-Bank half of the existing one. It covers an
  original `.xlsx` and an original multi-page PDF, checking:
  - cell types;
  - the IBAN and the credit limit in the PDF heading;
  - wrapped descriptions;
  - a 6012 top-up that pairs or not.

## 6. Integration

- [ ] 6.1 Run `pnpm test` and `pnpm typecheck` at the root (by the user if the sandbox blocks pnpm)
