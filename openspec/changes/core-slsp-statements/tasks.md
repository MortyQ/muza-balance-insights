# Tasks

## 1. Statement kit: rows below their anchor, table ends, cell lines (core)

- [x] 1.1 `pdfTable` options `rowBand` (`'around'` default, `'below'`), `pageEndRe` and `tableEndRe`, and `lines` per
  row (design 2). Verify with `tests/providers/statement-kit.test.ts`, using fictional items:
  - a row with three detail lines under its first line (`below`);
  - a footer under the last row of a page (`pageEndRe`);
  - a section after the last row that ends the table and has date anchors of its own (`tableEndRe`);
  - each cell's lines, parallel to the rows.

  Verify that the existing `around` cases and the A-Bank reader tests pass unchanged.

## 2. SLSP provider and reader (core)

- [x] 2.1 Add `slsp` to `PROVIDER_IDS`, create `providers/slsp/info.ts` and add its line in `PROVIDERS` (design 1).
  Verify the conformance info checks.
- [x] 2.2 `providers/slsp/descriptions.ts` (the type texts, the line patterns) and `categories.ts` (design 6), then
  `merchants.ts` with the keyword list approved in the proposal review (design 7). Then `rules.ts` and its line in
  `PROVIDER_RULES`. Verify with `tests/providers/slsp/rules.test.ts`, using fictional rows:
  - every type;
  - an incoming and an outgoing transfer;
  - a deposit;
  - a refund;
  - `TABAK-PRESS-BILLA` against `BILLA 113`;
  - a keyword inside a longer word;
  - `DM` at the start and in the middle;
  - diacritics;
  - an unknown merchant;
  - an unknown type (`knowsBankCategory` false).
- [x] 2.3 `providers/slsp/statement.ts`: the reader `slsp-account-pdf` (design 2–5) and its line in
  `STATEMENT_READERS`. Verify with `tests/providers/slsp/statement.test.ts`, using a fictional document builder
  (`tests/providers/slsp/documents.ts`):
  - two pages with the header repeated;
  - a card payment with GooglePay, with a token, and with a wrapped date;
  - a hryvnia purchase with a rate;
  - a withdrawal with a fee;
  - a deposit, a refund, and transfers of each type with their IBAN and name;
  - glued dates;
  - a «Nezrealizované transakcie» section;
  - a broken running balance (`bad-row` at that row), and totals that do not add up;
  - a header-only document (detect 1);
  - an A-Bank PDF fixture (detect 0).
- [x] 2.4 Conformance fixtures `tests/providers/slsp/fixtures/conformance/*.document.json` + `*.expected.json`: one
  statement and one `bad-row` case. The layout follows the masked analysis, and every value is fictional. Verify the
  conformance suite and the `purity`, `layers` and `providers-boundary` tests.

## 3. Desktop: the bank's look and names (desktop)

- [ ] 3.1 Create `entities/bank/looks/slsp.ts` (monogram `S`) and add `entities.bank.cardType.slsp.card` to `uk.json`,
  `en.json` and `ru.json` (design 9). Verify `apps/desktop` `providers.test.ts`, `i18n.test.ts`,
  `renderer/integrations.test.ts` and `renderer/registry-banks.test.ts`.
- [ ] 3.2 Create the `CHANGELOG.md` section `## 0.1.13 — unreleased` with a «Banks» entry for Slovenská sporiteľňa,
  with no internal terms.

## 4. Docs (docs)

- [ ] 4.1 `.agents/project/core-providers.md`: an «Slovenská sporiteľňa» section, the keyword hint for banks without an
  MCC, and the new `pdfTable` options in «Statement files». In `.agents/skills/core-architecture/SKILL.md`, the
  `pdfTable` mention. In `docs/backlog.md`: the time zone of card times abroad, the meaning of `BOLT.EU/O` and
  `/P`, and the first real SLSP upload (live checks).

## 5. Checks

- [ ] 5.1 Run `pnpm test` and `pnpm typecheck` at the root. Where the sandbox blocks root `pnpm`, run each package's
  commands from the core-architecture skill and ask the user to run the root ones.
