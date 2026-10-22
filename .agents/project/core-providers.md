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
  - `detect(doc)`: 0 — not mine, 1 — its format and part of its signature, 2 — its whole signature;
  - `read(doc)`: one `ParsedStatement` per account the file holds (currency, rows oldest first, closing balance, and
    `account { iban, cards, type }` as far as the file states them), or a `StatementProblem` code (with the row for
    `bad-row`). Never text from the file.
- **Picking.** `pickReader(doc)` in `providers/statements.ts` takes the readers whose `detect` is highest and above 0:
  none → `unknown-format`, two → `ambiguous`. Never by the file's name or the bank the user expected. The upload refuses
  a reader of another provider than the connection's as `other-bank`. The boundary test allows only `<id>/statement.ts`
  and `types.ts` in the registry.
- **Monobank's reader** (`monobank-card-uk`) takes the card statement in Ukrainian, because its service texts are the
  API's. It also recognises the English one (refused as `language`: translated texts) and the FOP one by its title line
  (score 1, refused as `unsupported-kind`). The card statement states no IBAN and no card number.
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

## Shared by every client

- The request slot is `src/providers/ratelimit.ts`; its interval comes from the provider.
- Errors are in `src/shared/errors.ts` (`RateLimitError`, `StatementFormatError`).
