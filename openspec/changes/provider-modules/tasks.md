# Tasks

Agent's sandbox: root `pnpm` cannot run, so each package's checks run from its folder (`.agents/skills/core-architecture`,
«Before handing over»). The user runs the root commands. No trust anchor changes in this change.

## 1. The provider info registry (feat(core): provider info registry)

- [x] 1.1 Add `ProviderInfo` to `providers/types.ts` (name, `access` with `token: { credential, api } | null` and `file`, `ids`, `cardTypes`, `defaultCardType`), `providers/monobank/info.ts` and the registry `providers/info.ts`. Move `api` out of `ProviderRules`. `ingest/plan.ts` (`WINDOW_SEC`, `windowSecFor`) and `read/status.ts` read `api` of token providers only. Extend `tests/providers-boundary.test.ts`: `providers/info.ts` is a fourth door, it may import only `<id>/info.ts` and `types.ts`, and each `<id>/info.ts` imports only `types.ts`. Add one breaking example per new rule. Verify that core's tsc and vitest pass with no figure test changed.
- [x] 1.2 Desktop:
  - `DESKTOP_PROVIDERS` becomes `{ service }` for token providers. The bank name comes from `PROVIDERS` (`main/people.ts`) and the credential from `PROVIDERS` (`main/integrations.ts`, `main/token.ts`, `shared/import-protocol.ts`).
  - `WORKER_PROVIDERS` and `FETCH` become maps over token providers, with `FETCH` built from `service`.
  - `ProviderKey` becomes core's `ProviderId` (`src/shared/api.ts`).

  Verify that `tests/providers.test.ts` checks the keys equal the token providers and that the Monobank client's host is among its service's hosts, and that `apps/desktop` tsc (node and web) and vitest pass.
- [x] 1.3 Update `apps/mcp` only where the contract moves (`api`), and rewrite `.agents/project/core-providers.md` in English around the registry. Verify that `apps/mcp` tsc and vitest pass, apart from the 7 known sandbox-only `cli-args` failures.

## 2. Operations without an MCC and the bank's category (feat(core): rows without an MCC)

- [x] 2.1 Add migration 17 (`storage/migrations/v17.ts`): `ALTER TABLE transactions ADD COLUMN bank_category TEXT` and `ADD COLUMN transfer_fee INTEGER`. The second stays unused until group 7. Verify with `tests/storage/` that a database at 16 migrates with every row intact and both columns NULL.
- [x] 2.2 Make `NormalizedTx.mcc` optional, add `bankCategory`, and make `RuleTx.mcc` `number | null` with `bankCategory`. Read `mcc` NULL-aware everywhere it is read today (`transfers`, `refunds`, `categories`, `derived`, `diagnostics`, `search`, `income`, `commit`); `commitRows` writes `bank_category`. Verify with new cases in `tests/derive/categories.test.ts` and `tests/derive/transfers.test.ts` on rows without an MCC: never treated as 0, default category with no hint.
- [x] 2.3 Widen `CategoryHint` to `CATEGORY_HINTS` (the domain keys a provider may suggest), keeping the `categorize` order. Monobank's rules return the same values as today. Verify that `tests/derive/derived-equivalence.test.ts` and every existing figure test pass unchanged, and that a fictional provider's hint from a bank category lands, under an override that still wins.
- [x] 2.4 Give `spendingSummary`'s `mcc` grouping its own key for NULL (apart from `COMMISSION_KEY`). Add `bank_category` to the analysis copy test's forbidden columns. Make the desktop data protocol's `statementRow.mcc` optional, with `bankCategory`. Verify with `tests/read/summaries.test.ts` (the null-MCC group), `apps/mcp` `analysis.test.ts`, and `apps/desktop` `data-protocol.test.ts`.
- [x] 2.5 Update `.agents/project/domain-rules.md`: rows without an MCC and the bank's category. Verify core's tsc and vitest.

## 3. Ids that never collide (feat(core): namespaced ids)

- [x] 3.1 Add `storedId(provider, bankId)` (`providers/ids.ts`, by `ProviderInfo.ids`) and apply it in `syncAccounts`, `commitWindow` and a new file account in `commitStatement`. Verify with a fictional `'prefixed'` provider in `tests/ingest/`: two providers send the same account and operation ids, both are stored, and statement row ids inherit the prefix. Verify also that Monobank's ids are byte-for-byte unchanged (`sync.test.ts`, `statement-import.test.ts`).
- [x] 3.2 Document the id rule in `core-providers.md`. Verify core's tsc and vitest.

## 4. Statement readers over a neutral document (feat(core): statement readers)

- [x] 4.1 Add to `providers/types.ts`: `StatementDocument`, `Cell`, `StatementReader` and the per-account `ParsedStatement` with `account { iban, cards, type }`, plus the problem codes `ambiguous`, `other-bank`, and `language` (renamed from `english`). Add `shared/excel-date.ts` with tests in `tests/shared/`. Before this group's commit, move `toMinor` from `monobank/statement.ts` to `shared/money.ts` in its own commit (`refactor(core): toMinor to shared`), lines unchanged, as `core-layout.md` asks for moves. Verify that the moved lines are identical and that core's tsc passes.
- [x] 4.2 Port the Monobank CSV reader to `StatementReader` (`detect` from the header: 2 for the Ukrainian card statement, 2 for the English one, which reads as `language`, and 1 for the FOP title line, which reads as `unsupported-kind`). `providers/statements.ts` → `STATEMENT_READERS` and `pickReader`. Verify with `tests/providers/monobank/statement.test.ts`: the same rows as before on the same fixtures, renamed extension irrelevant, and `pickReader` gives `unknown-format` / `ambiguous` with fictional decoy readers.
- [x] 4.3 `compareStatement` / `commitStatement` over a whole file:
  - matching by IBAN, then by masked card, else new;
  - per-statement targets and comparisons;
  - one batch for every account (split `commitRows` into building and running its statements);
  - a new account stores the IBAN and masked cards;
  - `rederiveCore` when a new IBAN or card number was written.

  Verify with `tests/ingest/statement-import.test.ts` and `statement-derivation.test.ts`:
  - two accounts in one fictional file;
  - one blocked account blocks the file and nothing is written;
  - a re-upload matches both and adds nothing;
  - two equal rows in one minute;
  - a file IBAN that another bank's row names makes that row an `iban` transfer;
  - stored values equal a full re-derivation.
- [x] 4.4 Update `core-providers.md` (readers, neutral document, matching). Verify core's tsc and vitest.

## 5. The statement decoder process (feat(desktop): statement decoder)

- [x] 5.1 Add the dependencies (`fflate`, `fast-xml-parser`, `pdfjs-dist`) at exact versions, after checking licences and `pnpm audit`, and record what was checked in the commit body. Spike: decode a generated fictional PDF in plain Node with the legacy build and the chosen options, as a test in `tests/decoder-pdf.test.ts`. Verify the test passes.
- [x] 5.2 Add `src/shared/decoder-protocol.ts`: zod schemas of `decode` and the reply, with the limits in the schema. Add `src/decoder/xlsx.ts` (only the workbook, shared strings and sheets inflated; declared size cap; cached formula values) and `src/decoder/pdf.ts` (text items with x, y, w, h). Verify with `tests/decoder.test.ts` on fixtures generated in the test (a zip of hand-written workbook XML, a hand-written PDF):
  - cells as typed text;
  - a zip bomb refused by its declared size;
  - limits refused with their codes;
  - an answer that breaks the schema refused.
- [x] 5.3 Add `src/decoder/process.ts` (one message, one reply, exit) and `src/main/decoder-client.ts` (fork per upload with `?modulePath`, `serviceName: 'balance-decoder'`, `env: {}`, killed after `DECODE_TIMEOUT_MS`), and the format sniffing by leading bytes in main. Verify with:
  - `tests/decoder-entry.test.ts`, as source like `data-entry`: `safeParse` in, `parse` out, one exit;
  - a fake-child test of the client: timeout kill, bad reply, exit without a reply;
  - sniffing cases.
- [x] 5.4 Extend `tests/main-imports.test.ts` with the decoder graph rule (no `electron`, `net`, `src/data/`, `src/worker/`, `src/main/`, `@mono/db-libsql`, and core only `shared/` and `providers/types.ts`), with a breaking example. Update `.agents/project/desktop-security.md` (the decoder: what it gets, what it cannot reach, limits) and the build entry in `electron.vite.config`. Verify `apps/desktop` tsc and vitest pass.

## 6. Upload any bank's statement (feat(desktop): statement upload by file kind)

- [x] 6.1 Main:
  - `StatementsService.open` reads, sniffs, decodes (text in main, binary through the decoder), runs `pickReader`, refuses `other-bank`, reads, and keeps the statements under one id;
  - the dialog offers the extensions the readers know plus «All files»;
  - the data protocol's `parsedStatement` becomes the per-account list, with targets per statement.

  Verify with `tests/statements.test.ts`: a Monobank CSV as before, a renamed CSV, another bank's fictional reader refused as `other-bank`, a decoder failure, too large; with `tests/data-protocol.test.ts`; and with `ipc.test.ts`.
- [x] 6.2 Renderer, `features/integrations/statement-file`:
  - the comparison lists one row per statement (card type, currency, last card digits, counts, target select);
  - one «Write» covers all;
  - new problem codes are worded;
  - the «CSV» wording becomes generic.

  New keys go in `uk.json`, `en.json` and `ru.json`. Verify with `tests/renderer/statement-upload.test.ts` (one and two accounts, a blocked account, each problem code) and `tests/i18n.test.ts`.
- [x] 6.3 Update `.agents/project/desktop-import.md` (the upload flow by file kind, the decoder, several accounts). Verify `apps/desktop` tsc (node and web) and vitest pass.

## 7. Transfers between banks (feat(core): transfers between banks)

- [x] 7.1 In `derive/transfers.ts`, add the cross-bank pass after `pair_fee`:
  - different providers, one currency, both transfer-like, `0 ≤ dt ≤ 180`, `0 ≤ d`, `100·d ≤ 5·credit`;
  - nearest, then smallest difference, then ids;
  - `pair` / `pair_fee` / `family`;
  - `transfer_fee` on the debit, cleared when the pair goes.

  Widen the pass context and `deriveSpan` only when two providers exist. Verify with `tests/derive/transfers.test.ts` (each spec scenario of `core-cross-bank-transfers`) and that the Monobank-only fixtures' marks are unchanged.
- [x] 7.2 Add the `transfer_fee` line kind to `spendingLinesSql` with the `transferFees` category, its body rule and the crossing rule. Add `home.spending.category.transferFees` to the three dictionaries. Verify with `tests/read/fees-aggregates.test.ts` and `family.test.ts`:
  - an implicit fee in the person and family views;
  - a stated commission as bank fees;
  - a crossing pair counted whole;
  - `spendingSummary`, `spendingGrid` and the desktop overviews agree.
- [x] 7.3 Add a two-bank fixture to `tests/derive/derived-equivalence.test.ts` and to the performance harness. Verify that incremental equals full and the budgets hold.
  The harness part is deferred to `docs/backlog.md` («The benchmark with two banks»): the bench uses the real registry, which holds Monobank only. A one-off run with a mocked second bank showed no slowdown.
- [x] 7.4 Update `domain-rules.md` (cross-bank pairs, the transfer fee, the tolerance and why there is no floor). Verify core's and desktop's tsc and vitest.

## 8. Banks from the registry in the renderer (feat(desktop): banks from the registry)

- [x] 8.1 Allow `@mono/core/providers/info` in `tests/helpers/architecture.ts`, and test that its import closure is `types.ts` and `<id>/info.ts` only. Verify `tests/architecture.test.ts` passes and fails on a breaking import.
  The closure also allows each bank's `constants.ts`, as core's boundary test does (Monobank's info takes its API limits from there).
- [x] 8.2 `entities/bank`:
  - `BANKS` from the registry, without the «soon» tiles;
  - `bankOf()` returns a neutral entry for an unknown id;
  - looks by glob;
  - `accountName()` takes the provider, with `AccountName` gaining `provider`;
  - card type names under `entities.bank.cardType.<provider>.<type>`, with a generic fallback.

  Verify with `tests/renderer/` (an unknown provider gets the neutral mark, Monobank names unchanged), `account-name.test.ts` and `i18n.test.ts`.
- [x] 8.3 `features/integrations`:
  - `PROVIDER_FORMS` partial, `DEFAULT_PROVIDER` removed, `BankPicker` in «Add connection» when the registry has more than one bank;
  - the generic file flow for a bank without a form;
  - `DEFAULT_NEW_CARD_TYPE` replaced by the provider's `defaultCardType`.

  `features/import-statement`: one list per token provider (done as one list headed by the token banks' names: the import is one action for every token connection, `startImport(from)` takes no provider). `features/balances`: the bank name from the registry. Verify with `tests/renderer/integrations.test.ts`, `import-history.test.ts` and `balances.test.ts`, with a fictional file-only provider in the test registry.
- [x] 8.4 Update `.agents/project/desktop-renderer.md` (banks come from the registry; what a bank may add). Verify `vue-tsc -p tsconfig.web.json` and the renderer tests pass.

## 9. Conformance and the «add a bank» procedure (test(core): provider conformance)

- [ ] 9.1 Add `packages/core/tests/providers/conformance.test.ts` over `PROVIDER_IDS` (design, decision 10), with Monobank's fixtures as JSON documents and expected results. Verify it passes for Monobank and fails for a fictional provider breaking each rule (a `'bare'` id, `api` without token, a hint outside `CATEGORY_HINTS`, a reader that claims another provider's fixture).
- [ ] 9.2 Add the «Add a bank» section to `.agents/skills/core-architecture`: files, registries, fixtures, the renderer look and form, and the checks. Verify that every path it names exists.

## 10. Checks (docs: provider modules checks)

- [ ] 10.1 Add the live checks of the design's migration plan to `docs/backlog.md`:
  - a real two-bank pair and its fee;
  - the fee floor;
  - decoding real PrivatBank `.xlsx` and A-Bank `.pdf` files;
  - the decoder's memory on a large PDF.

  Verify that the entries are present.
- [ ] 10.2 Run `pnpm test` and `pnpm typecheck` at the root. The user runs them where the agent's sandbox cannot; the agent runs each package's checks from its folder. Verify that all pass.

## Workflow follow-up

- Sync the specs (`openspec-sync-specs`) and archive the change once every group is committed.
