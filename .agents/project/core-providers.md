# Core: bank providers

Moved from the root `CLAUDE.md` on 2026-09-27; rewritten in English with the provider registry (change
`provider-modules`). Area: `packages/core`.

The folder layout of `packages/core/src` and where new code goes: `core-layout.md`. The first spec of connections:
`reports/2026-09-26-connections-spec.md`.

## The contract and the registries

- **The contract** is `providers/types.ts`, and it imports nothing. It holds:
  - `ProviderInfo`, `ProviderRules` and `ProviderClient`;
  - `NormalizedAccount` / `NormalizedTx`;
  - the statement file types.
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
  - **statement** (`statement.ts`): optional, a statement file reader (below).
- **The domain reaches a provider only through four doors**. The domain is every folder but `providers/`:
  `derive/`, `read/`, `ingest/` and the rest.
  - `providers/types.ts`, the contract;
  - `providers/info.ts`, the only list of banks: `PROVIDERS`, `infoOf`, `TOKEN_PROVIDER_IDS` / `TokenProviderId`,
    `isTokenProvider`, `apiOf` (an error for a bank without an API) and `credentialFits`;
  - `providers/rules.ts`, the rules registry (`rulesFor`);
  - `providers/statements.ts`, the statement parsers registry.

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

## Monobank

- Its files are `providers/monobank/{info,rules,descriptions,client,constants,statement}.ts`.
- The client takes its origin and name from `info.ts`.
- Its ids are `'bare'`: they are stored as the bank sends them.

## Accounts and connections

- **The provider of an account** is `connections.provider` of its connection (`accountProviders` / `providerOf` in
  `people/connections.ts`). An account without a connection is an error, not a default.

## Statement files

- **The parser.** It is the provider's optional half, `providers/<id>/statement.ts`: a pure `StatementFileParser`
  (text → `ParsedStatement`, or a `StatementProblem` code).
  - It is listed in `providers/statements.ts`.
  - The boundary test allows only `<id>/statement.ts` and `types.ts` there.
- **Monobank's statements.** It takes the card statement in Ukrainian, because its service texts are the API's. The
  English one (translated texts) and the FOP one are refused, each with its own code.
- **Reading.**
  - Money is read as text into minor units.
  - An absent cell (`—`) stays absent.
  - The CSV reader is `src/shared/csv.ts`.
- **Writing.** `src/ingest/statement-import.ts`:
  - `compareStatement` returns counts and what blocks the write: a token connection, another currency, a hole.
  - `commitStatement` writes through `commitRows` of `ingest/commit.ts`, the write half of `commitWindow`, without
    hold cancelling.
- **Row ids.** They are made from the account, the second, the amount and the order among equal rows.

## Shared by every client

- The request slot is `src/providers/ratelimit.ts`; its interval comes from the provider.
- Errors are in `src/shared/errors.ts` (`RateLimitError`, `StatementFormatError`).
