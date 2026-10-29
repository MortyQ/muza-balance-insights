# Core: bank providers

Moved from the root `CLAUDE.md` on 2026-09-27; rewritten in English with the provider registry (change
`provider-modules`). Area: `packages/core`.

The folder layout of `packages/core/src` and where new code goes: `core-layout.md`. The first spec of connections:
`reports/2026-09-26-connections-spec.md`.

## The contract and the registries

- **The contract** is `providers/types.ts`, and it imports nothing. It holds:
  - `ProviderInfo`, `ProviderRules` and `ProviderClient`;
  - `NormalizedAccount` / `NormalizedTx`;
  - the statement file types: `StatementDocument`, `Cell`, `StatementReader`, `ParsedStatement`.
- **A provider is up to four halves**, each in `providers/<id>/`:
  - **info** (`info.ts`): pure data, importing only `types.ts` and its own `constants.ts`. It holds:
    - the name;
    - `access`: `token: { credential, api } | null`, plus `file`;
    - `ids`;
    - `cardTypes`, `defaultCardType`.

    `api` (`origin`, `requestIntervalMs`, `maxWindowSec`) exists only for a bank with an API.
  - **rules** (`rules.ts`): pure. Row traits, masking.
  - **client** (`client.ts`): network, pages, 429. Optional, for a bank with an API. Re-derivation (`rederive`) never
    loads a client.
  - **statement** (`statement.ts`): optional, the bank's statement file readers (below).
- **The domain reaches a provider only through five doors**. The domain is every folder but `providers/`:
  `derive/`, `read/`, `ingest/` and the rest.
  - `providers/types.ts`, the contract;
  - `providers/info.ts`, the only list of banks: `PROVIDERS`, `infoOf`, `TOKEN_PROVIDER_IDS` / `TokenProviderId`,
    `isTokenProvider`, `apiOf` (an error for a bank without an API) and `credentialFits`;
  - `providers/rules.ts`, the rules registry (`rulesFor`);
  - `providers/statements.ts`, the statement readers registry (`STATEMENT_READERS`, `pickReader`);
  - `providers/ids.ts`, stored ids (below). It imports only `info.ts` and `types.ts`.

  Each registry imports only its own half of each bank, plus `types.ts`. Providers never import each other.

  Domain code contains no MCC 4829/6012, no Monobank texts, no `'fop'` and no bank host.

  `packages/core/tests/providers-boundary.test.ts` checks all of this, with a breaking example per rule.
- **The import plans by the API facts of token providers only**:
  - `WINDOW_SEC` is the smallest window among them;
  - the status's `next_request_at` uses each connection's own interval.

  A file-only bank brings no API facts.
- **Who reads `providers/info.ts`.** The desktop's main, worker and (with change `provider-modules`, group 8) renderer
  read banks from it: their names, whether a credential fits, which banks have an API. `PROVIDER_IDS` (in
  `types.ts`) stays the one id list.

## Ids

- **Stored ids never collide between banks.** `ProviderInfo.ids` says how a bank's account and operation ids are
  stored:
  - `'bare'`: as the bank sends them. Monobank only; its ids contain no `:`.
  - `'prefixed'`: `<provider>:<bank id>`. Every other bank.
- **One place turns a bank id into a stored id**: `storedId(provider, bankId)` in `providers/ids.ts`. It is applied
  where ids enter storage, and nowhere else:
  - `syncAccounts`, for the accounts the client sends;
  - `commitWindow`, for the operations of a window;
  - `commitStatement`, for a new file account (the caller's fresh id).
- **Back to the bank.** `fetchWindow` asks the client by `bankIdOf(provider, storedId)`. A stored id without the
  provider's prefix is an error.
- **Statement row ids** derive from the stored account id, so they inherit the prefix.
- **No rewrite.** Monobank's stored ids stay as they are; no migration touches them.

## Monobank

- Its files are `providers/monobank/{info,rules,descriptions,client,constants,statement}.ts`.
- The client takes its origin and name from `info.ts`.
- Its ids are `'bare'`: they are stored as the bank sends them (see «Ids»).

## PrivatBank

- Files only (`access.token: null`): `providers/privatbank/{info,rules,descriptions,categories,statement}.ts`, ids
  `'prefixed'`, one card type `card` (the statement does not name the product).
- Its readers `privatbank-card-uk` and `privatbank-card-en` (`xlsx`) take the Privat24 card statement in its two
  languages, from one layout code with a table per language: the title row «Історія операцій за період …» / «Transaction
  history for the period …» (score 2; the ten headers alone score 1; each reader scores 0 on the other language), rows
  newest first, empty rows skipped, one statement per masked card. No MCC: the bank's category per row. A debit costing
  more than its operation in the same currency stores the difference as its commission; a credit never does (a
  withheld fee on a transfer from the user's other bank is the cross-bank pair's `transfer_fee`, counted once).
- Transfers by its bank category (`TRANSFER_CATEGORIES`), own transfers by its service texts (`descriptions.ts`). The
  category table and the service texts hold both languages; a bank category is stored as the file states it.

## A-Bank

- Files only (`access.token: null`): `providers/abank/{info,rules,descriptions,categories,statement}.ts`, ids
  `'prefixed'`, one card type `card`.
- Its readers `abank-card-xlsx` (`xlsx`) and `abank-card-pdf` (`pdf`) take the card statement in Ukrainian («Виписка по
  картці») from one column list: eleven headers, both spellings («в валюті картки» / «у валюті карти», a Latin or a
  Cyrillic «MCC»). Heading lines above the table: the IBAN (`Рахунок:`) and the credit limit. Score 2 with the
  workbook's account or card line, or the PDF's bank name or title; 1 with the headers alone. A PDF row is read across
  its lines by `pdfTable` (the date above, the time below). One file is one account: its IBAN and every card its rows
  name (`-` = none). Times to the minute; the card amount includes the fee (kept as the commission); cashback per row.
- The MCC decides, as for Monobank: 4829 a transfer, 6012 a financial institution; the cashback credit («Зарахування
  кешбеку на картку», 4829) is income, never a transfer; `MONO*<name>` a named sender; a credit with a merchant code or
  without one (not a transfer, not 6012) a refund. `categories.ts` is empty: the bank states no category.

## Slovenská sporiteľňa

- Files only (`access.token: null`): `providers/slsp/{info,rules,descriptions,categories,merchants,statement}.ts`, ids
  `'prefixed'`, one card type `card` (the account's one card; the app's statement kind is `card`).
- Its reader `slsp-account-pdf` (`pdf`) takes the monthly account statement in Slovak («Výpis z Účtu»). The six-column
  header over two lines; rows oldest first, each from its first line (both dates — one item over both date columns,
  or two —, the type, amount, fee, balance) down to the next (`rowBand: 'below'`); footers and the closing note end a
  page's table, «Nezrealizované transakcie» (operations not carried out) ends the table. The heading gives the IBAN,
  the currency, the opening and closing balances and the totals. Score 2 with the title and the bank's BIC, 1 with the
  header alone. Times: a card operation's own moment from its details, to the second, else the booking date;
  Europe/Bratislava. Amount = sum + fee, the fee kept as the commission; a stated foreign amount is the operation
  amount. Transfers carry the counterparty's IBAN and name.
- **The file is checked against itself**: every printed balance follows from the one before (amount and fee), and the
  heading's totals and closing balance add up; any break refuses the file as `bad-row`.
- No MCC and no category: the operation type is stored as the bank category (`categories.ts`): the four transfer
  types decide transfers (income or p2p by sign), «Výber kartou» is cash, «Vklad cez ATM» income, «Návrat tovaru» a
  refund. Own transfers come from the domain's IBAN rule only.
- **Merchant keywords** (`merchants.ts`): card payments (and refunds) the type leaves open get a hint from the
  merchant text. Whole words of the text without diacritics; the first entry that matches wins (specific before
  general, a kiosk «TABAK PRESS» before «BILLA»); `first` entries only at the start; no match → no hint («other»).
  Chains and brands only, never a small local place; a new keyword needs the user's ok, like a masking template. Only
  for a bank that states neither an MCC nor a category: never applied to a row that has one.
- Masking keeps no SLSP text: every description is `[other]` (a merchant or a person's name).

## Bank categories

- **One table per bank**: `providers/<id>/categories.ts` exports `BANK_CATEGORIES` (bank category → a common hint of
  `CATEGORY_HINTS`, or `null` = known, decided by the rules). The bank's `categoryHint` reads it; `knowsBankCategory`
  answers whether a name is in it. A bank never adds a category of its own.
- **Unknown ones are reported**: the re-derivation report (recategorize) lists every bank category its table does not
  know, with the bank and the row count (`unknownBankCategories`, `derive/diagnostics.ts`).

## Accounts and connections

- **The provider of an account** is `connections.provider` of its connection (`accountProviders` / `providerOf` in
  `people/connections.ts`). An account without a connection is an error, not a default.

## Statement files

- **The document.** A reader never gets bytes. The caller turns a file into a `StatementDocument`:
  - `text`: decoded from UTF-8, the BOM stripped;
  - `sheets`: a grid of `Cell`s per sheet; a cell keeps its stored value as text (`t` is `s`, `n` or `b`), numbers
    never as floats;
  - `pdf`: text items with their page, `x`, `y`, `w`, `h`.

  The core holds no archive or PDF code (the desktop decodes them).
- **The readers.** `providers/<id>/statement.ts` exports `readers: StatementReader[]`, one per kind of file of that
  bank. A reader is pure:
  - `extensions`: what its files are usually named with (lowercase, no dot), for the open dialog's filter only;
  - `detect(doc)`: 0 — not mine, 1 — its format and part of its signature, 2 — its whole signature;
  - `read(doc)`: one `ParsedStatement` per account the file holds (currency, rows oldest first, closing balance, and
    `account { iban, cards, type }` as far as the file states them), or a `StatementProblem` code (with the row for
    `bad-row`). Never text from the file.
- **Picking.** `pickReader(doc)` in `providers/statements.ts` takes the readers whose `detect` is highest and above 0:
  none → `unknown-format`, two → `ambiguous`. Never by the file's name or the bank the user expected. The upload refuses
  a reader of another provider than the connection's as `other-bank`. The boundary test allows only `<id>/statement.ts`
  and `types.ts` in the registry.
- **Monobank's reader** (`monobank-card-uk`, `csv`) takes the card statement in Ukrainian, because its service texts are the
  API's. It also recognises the English one (refused as `language`: translated texts) and the FOP one by its title line
  (score 1, refused as `unsupported-kind`). The card statement states no IBAN and no card number.
- **Shared reader helpers**: `providers/statement-kit.ts` (`gridOf`, `columnsByHeader`, `normHeader` — composed
  letters, lower case, one space —, `wallTime`, `isEmptyRow`, `localAmount` for `1 234,56`; for a PDF `pdfLines`,
  `lineSegments` and `pdfTable`: a header over several lines found by its column names on each page, a row's cells across
  its lines; options `rowBand: 'below'` for details under a row's first line, `pageEndRe` / `tableEndRe` for footers and
  a section after the operations, and `lines`, each cell's lines). A new reader is mostly its column list on top of
  them.
- **The credit limit.** A statement may state it (`ParsedStatement.creditLimit`); the import stores it with a new
  account and, like the balance, only from a newer statement. The balance then includes it, as Monobank's API does.
- **Reading values.**
  - Money is read as text into minor units: `toMinor` in `src/shared/money.ts`.
  - A date cell is an Excel serial: `excelSerialToUnix` in `src/shared/excel-date.ts`, in the statement's zone.
  - An absent cell (Monobank's `—`) stays absent.
  - The CSV reader is `src/shared/csv.ts`.
- **Matching.** `src/ingest/statement-import.ts` takes the whole file (`ParsedStatement[]`). Each statement goes to:
  - the caller's target (`StatementTarget`: an account of the connection, or a new one with the caller's id);
  - else a card account of the connection with the same IBAN, else one holding one of its masked card numbers (spaces
    ignored);
  - else it is offered as new.

  Each account takes at most one statement of a file.
- **Comparing.** `compareStatement` returns, per statement, the match (`StatementMatch`), counts and what blocks the
  write: a token connection, another currency, a hole in the account's coverage.
- **Writing.** `commitStatement` takes one target per statement and writes every account of the file in one batch, or
  none (any blocked statement → `StatementImportError`):
  - a new account stores the file's IBAN and masked cards; an existing one gets an IBAN it lacked and cards it lacked,
    and its balance when the file is newer;
  - the rows go through `prepareRows` of `ingest/commit.ts` (the statements `commitRows` runs, built without running),
    without hold cancelling;
  - then one derivation pass over the file's whole span (`deriveCommitted`); a full `rederiveCore` when that failed or
    when the file wrote an IBAN or a card number the connection's accounts did not have.
- **Row ids.** They are made from the stored account id, the second, the amount and the order among equal rows, so a
  re-upload adds only new rows, also for times stated to the minute.

## Conformance

- Every id in `PROVIDER_IDS` passes `packages/core/tests/providers/conformance.test.ts`, which is never edited for a
  bank: its info (`ids: 'bare'` for Monobank only, `api` only inside a token access, `defaultCardType` among
  `cardTypes`, `access.file` exactly when it has readers), its stored ids, its rules on rows with and without an MCC or
  a bank category (no throw, `categoryHint` within `CATEGORY_HINTS`), and its readers on its fixtures in
  `tests/providers/<id>/fixtures/conformance/` (`<name>.document.json` + `<name>.expected.json`: read as expected,
  twice the same, picked by the document alone, `detect` 0 on every other bank's fixture). Fictional data only.
- The procedure for a new bank is «Add a bank» in `.agents/skills/core-architecture`.

## Shared by every client

- The request slot is `src/providers/ratelimit.ts`; its interval comes from the provider.
- Errors are in `src/shared/errors.ts` (`RateLimitError`, `StatementFormatError`).
