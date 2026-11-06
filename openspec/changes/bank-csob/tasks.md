# Tasks

## 1. ČSOB provider and reader (core)

- [x] 1.1 Add `csob` to `PROVIDER_IDS`, create `providers/csob/info.ts` and add its line in `PROVIDERS` (design 1).
  Verify the conformance info checks.
- [x] 1.2 `providers/csob/iban.ts` (design 4). Verify with `tests/providers/csob/iban.test.ts`: a number without a
  prefix, with a prefix, short numbers padded, and a known-valid fictional IBAN's check digits.
- [x] 1.3 `providers/csob/descriptions.ts` (types, the standing order pattern), `categories.ts` (design 5), then
  `rules.ts` and its line in `PROVIDER_RULES`. Verify with `tests/providers/csob/rules.test.ts`, using fictional rows:
  - every type;
  - an incoming and an outgoing transfer with a generic category;
  - a transfer with a spending category;
  - a refund;
  - a cash deposit;
  - every category;
  - an unknown category (`knowsBankCategory` false).
- [x] 1.4 `providers/csob/statement.ts`: the reader `csob-account-csv-en` (design 2, 3, 6) and its line in
  `STATEMENT_READERS`. Verify with `tests/providers/csob/statement.test.ts`, on a fictional document builder:
  - unsigned integer amounts by type;
  - signed amounts with a decimal comma and with a dot;
  - an unknown type (`bad-row` at that row);
  - a foreign original amount, and a CZK one that is not stored;
  - a Czech counter account with a prefix (IBAN), and a BIC one (no IBAN);
  - a `Place:` note, and a row without a note;
  - trailing balance-only rows;
  - two account numbers or two currencies (`bad-row`);
  - newest-first input handed over oldest first;
  - the header alone (detect 1), with the title (detect 2), and a Monobank CSV fixture (detect 0).
- [x] 1.5 Conformance fixtures `tests/providers/csob/fixtures/conformance/*.document.json` + `*.expected.json`: one
  statement and one `bad-row` case, in the masked layout with fictional values. Verify the conformance suite and the
  `purity`, `layers` and `providers-boundary` tests.

## 2. Desktop: the bank's look and names (desktop)

- [x] 2.1 Create `entities/bank/looks/csob.ts` and add `entities.bank.cardType.csob.card` to `uk.json`, `en.json` and
  `ru.json` (design 8). Verify `apps/desktop` `providers.test.ts`, `i18n.test.ts`, `renderer/integrations.test.ts` and
  `renderer/registry-banks.test.ts`.
- [x] 2.2 `CHANGELOG.md`, `0.1.14 — unreleased`: a «Banks» entry for ČSOB, with no internal terms.

## 3. Docs (docs)

- [x] 3.1 `.agents/project/core-providers.md`: a «ČSOB» section (reader, direction, IBAN, the bank category rule). In
  `docs/backlog.md`: the first real ČSOB upload (sign and decimals of amounts, whether the balances reconcile, then the
  self-check), and a Czech-language export.

## 4. Checks

- [ ] 4.1 Run `pnpm test` and `pnpm typecheck` at the root. Where the sandbox blocks root `pnpm`, run each package's
  commands from the core-architecture skill and ask the user to run the root ones.
