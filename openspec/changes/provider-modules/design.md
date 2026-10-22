# Design

## Context

See `proposal.md` («Why»). The current state that shapes the approach:

- **Core.** The domain already reaches a bank only through `providers/types.ts`, `providers/rules.ts` and
  `providers/statements.ts`, checked by `tests/providers-boundary.test.ts`. What still assumes one bank:
  - every provider must have `ProviderRules.api`: `ingest/plan.ts` (`WINDOW_SEC`) and `read/status.ts` take the
    minimum or maximum over all providers;
  - `NormalizedTx.mcc` is required and the domain reads `Number(r.mcc)`. The column has been nullable since migration
    16, so a NULL would be read as 0;
  - `CategoryHint` is four fixed values, so a bank's own category column has nowhere to go;
  - a statement parser takes text (`parse(text)`) and returns one `ParsedStatement` of `kind: 'card'`. The upload
    writes one account per call and stores no IBAN or card number for it;
  - ids are the bank's own. Statement rows are `<accountId>:<time>:<amount>:<n>`, and a new file account is
    `file-<uuid>` (made in main).
- **Desktop.** The full map is in the audit of this change's exploration. The points that block a second bank:
  - `DESKTOP_PROVIDERS`, `WORKER_PROVIDERS` and the worker's `FETCH` are `Record<ProviderId, …>` with a required
    credential, so a file-only bank is a type error;
  - the upload decodes the file as UTF-8 text in main (`main/statements.ts`), and the dialog offers only `.csv`;
  - the data protocol's `statementRow` requires `mcc`, and `parsedStatement` has `kind: 'card'` with one account;
  - in the renderer, `entities/bank` keeps its own `BANKS` list (with PrivatBank «soon»), and `bankOf()` falls back to
    Monobank. `accountName()` always uses Monobank's card types, because `AccountName` carries no provider.
    `PROVIDER_FORMS` and `DEFAULT_PROVIDER = 'monobank'` drive «Add connection», and the balance card prints a
    literal «Monobank».
- **Not leaks, kept on purpose.** These name Monobank because they are Monobank's, not because the app assumes one bank:
  - the database file name `monobank.db`;
  - the rates source (`api.monobank.ua/bank/currency`, the one source of today's rates, whatever banks are connected);
  - the legacy `token.bin`, which was Monobank's;
  - `unpaired_service_4829` and the recategorize report text (a trust anchor's output, changed only with the user's ok);
  - `apps/mcp`, a developer tool on a Monobank token.

  See decision 9.

Rules followed:
- `.agents/project/core-layout.md`: layers, where new code goes, and moves as their own commits.
- `.agents/project/core-providers.md`: the provider boundary.
- `.agents/project/core-people.md`: connections, methods.
- `.agents/project/domain-rules.md`: transfers, fees, categories, crossing, derivation.
- `.agents/project/desktop-import.md`: the statement upload, the worker, the data process.
- `.agents/project/desktop-security.md`: processes, network, IPC gates.
- `.agents/project/desktop-renderer.md`: FSD, `shared/ui` first, i18n.

Updated by this change:
- `core-providers.md`: rewritten in English around the registry, readers and ids.
- `domain-rules.md`: rows without an MCC, the bank's category, cross-bank pairs, transfer fees.
- `desktop-import.md`: the upload flow and the decoder process.
- `desktop-security.md`: the decoder process.
- `desktop-renderer.md`: banks come from the registry.
- `.agents/skills/core-architecture`: the «add a bank» procedure.

## Goals / Non-Goals

**Goals:**
- Adding a file-only bank means:
  - a core folder `providers/<id>/` (info, rules, readers);
  - one line in each core registry;
  - fixtures for the conformance suite;
  - optionally, a look and a form in the renderer.

  An API bank also adds its client and the desktop `integrations/<id>/` (service id, worker error mapping).
- With only Monobank data, no figure, id or stored value changes.
- The other team gets a stable reader contract and a neutral document they can write fixtures for without
  Electron.

**Non-Goals:**
- The PrivatBank and A-Bank readers themselves. The conformance suite is ready for them.
- Several token connections of one provider, OAuth, new API clients.
- Renaming `@mono/*` packages, the database file, or `apps/mcp`'s Monobank wiring.
- Cross-currency pairs across banks.

## Decisions

### 1. The registry: a core `ProviderInfo` per bank, pure data

Each bank gets `providers/<id>/info.ts`, and `providers/info.ts` lists them as `PROVIDERS: Record<ProviderId,
ProviderInfo>` (types in `providers/types.ts`). `PROVIDER_IDS` stays the one id list. A `ProviderInfo` holds:
- `name`: the brand name, not translated.
- `access`: `{ token: { credential: RegExp source, api: ProviderApiInfo } | null, file: boolean }`. `api` moves here
  from `ProviderRules`, so a file-only bank has none. `WINDOW_SEC` and the status's longest interval are taken over
  token providers only.
- `ids`: `'bare' | 'prefixed'` (decision 3).
- `cardTypes`: the provider's card type ids, for screens and the new-account choice. `defaultCardType` is one of them
  or null.

Rules (`providers/rules.ts`) and readers (`providers/statements.ts`) stay separate registries, because `rederive`
must not load readers and `recategorize` must not load clients. The boundary test gains `providers/info.ts` as the
fourth door. It allows `<id>/info.ts` there and requires every `<id>/info.ts` to import only `types.ts`.

Desktop:
- `DESKTOP_PROVIDERS` shrinks to `{ service: ServiceId }` for token providers only. The bank name and credential come
  from `PROVIDERS`.
- `WORKER_PROVIDERS` and `FETCH` become maps over token providers, with `FETCH` built from each entry's `service`.
- `tests/providers.test.ts` checks that their keys are exactly the token providers, and that the core client's host is
  one of its service's hosts.

`TRUSTED_SERVICES` stays written out literally in `net/allowlist.ts`, so the network allowlist is still reviewed in
one place. A provider names its service but cannot add hosts.

Alternatives considered:
- **One module object per bank holding rules, client, readers and info.** Rejected: importing it for the info pulls
  in the client (network) and the readers. That breaks the rule that `rederive` loads no client, and it bloats the
  renderer.
- **Hosts declared by the provider and merged into the allowlist.** Rejected: a provider folder could then widen the
  network surface without touching `net/`.

Verdict: separate registries per half, with the info half as pure data.

### 2. The renderer reads the registry directly

The renderer imports `@mono/core/providers/info`, a pure constant module whose import closure is `types.ts` and the
`<id>/info.ts` files. `tests/helpers/architecture.ts` allows it next to `@mono/core/shared/currency`, and a test pins
its closure to those files.

FSD placement:
- `entities/bank`:
  - `BANKS` becomes the registry's list. The «soon» tiles go; «Other bank» stays as a non-bank tile.
  - `bankOf(id)` returns the registry entry, or a neutral entry for an unknown id. There is no Monobank fallback.
  - Per-bank looks (monogram, logo) are found by `import.meta.glob` under `entities/bank/assets/` and
    `entities/bank/looks/<id>.ts`. A missing look gives the neutral mark.
  - `accountName()` takes the provider. `AccountName` (`src/shared/account-name.ts`) gains `provider`, and card type
    names are dictionary keys `entities.bank.cardType.<provider>.<type>`, falling back to a generic «Card».
- `features/integrations`:
  - `PROVIDER_FORMS` becomes `Partial<Record<ProviderId, ProviderForms>>`, with entries only for banks that need their
    own token form (Monobank).
  - A file-only bank uses the generic file flow. `DEFAULT_PROVIDER` goes.
  - «Add connection» in settings shows `BankPicker` when more than one bank is in the registry.
- `features/import-statement` (the API import): one list per token provider, headed by the provider's name.
- `features/balances`: the card's bottom line takes the bank name from the registry.

Alternative considered: **an IPC method `getProviders()`.** Rejected: the data is static. An IPC call would add a
loading state to every bank mark for nothing, and the closure test keeps the import safe.

### 3. Ids: a prefix for every bank but Monobank, no rewrite

`ProviderInfo.ids` is `'bare'` for Monobank and `'prefixed'` for any other bank (the conformance suite fails a new
`'bare'` provider). The core turns a bank id into a stored id in one function, `storedId(provider, bankId)`, in
`providers/ids.ts`. It is applied where ids enter storage: `syncAccounts`, `commitWindow` and a new file account in
`commitStatement`. Statement row ids keep deriving from the stored account id, so they inherit the prefix.

Monobank's API ids contain no `:`, and its statement ids start with its own account id. A prefixed id (`<provider>:…`)
therefore cannot equal a Monobank id.

Alternative considered: **prefix every id, Monobank's included, with a migration that rewrites them.** Rejected:
- account and operation ids are referenced from `transfer_pair_id`, `refund_pair_id`, `transaction_raw`, `sync_state`
  and `accounts`, with no `ON UPDATE CASCADE`;
- the rewrite would be a table-rebuild migration on every user's data, for no user-visible gain.

### 4. Rows without an MCC, and the bank's category

- **The model.** `NormalizedTx.mcc` becomes optional, and `RuleTx.mcc` becomes `number | null`.
  - Every domain read of `mcc` goes through a NULL-aware helper; `Number(null)` is never used. Today's readers are
    `transfers`, `refunds`, `categories`, `derived`, `diagnostics`, `search` and `income`.
  - The MCC table maps only numbers.
  - `spendingSummary`'s `mcc` grouping gives NULL its own key (`'none'`), apart from `COMMISSION_KEY`.
- **New columns, migration 17.** `transactions.bank_category TEXT`, plus `transfer_fee INTEGER` for decision 7, as
  `ALTER TABLE … ADD COLUMN`.
  - No table rebuild: the transfer rule's `CHECK` does not change (decision 7).
  - Migration 16 is not edited, since migrations are append-only and a developer database may already be at 16.
  - `NormalizedTx.bankCategory` and `RuleTx.bankCategory` carry the column.
- **The hint.** `CategoryHint` widens from four values to the domain category keys a provider may suggest
  (`CATEGORY_HINTS` in `types.ts`: every key of `CATEGORY` except `fees`, `transferFees`, `ownTransfers` and `family`,
  which only the derivation sets). `categorize` keeps its order: internal → family → override → hint → MCC → default.
  A provider maps its `bankCategory` inside `categoryHint`. It returns null when the MCC should decide.
- **Privacy.** The analysis copy is a whitelist, so `bank_category` stays out of it with no change. The whitelist
  test gains it as a forbidden column, as for `description`.

Alternative considered: **the reader maps the bank's category to a hint at read time and stores only the hint.**
Rejected: a corrected mapping would need a re-upload instead of a re-derivation, and the bank's own words would be
lost.

### 5. Readers over a neutral document

`providers/types.ts` gains:

```ts
type Cell = { t: 's' | 'n' | 'b'; v: string } | null;   // the stored value as text; numbers never as floats
type StatementDocument =
  | { format: 'text'; text: string }
  | { format: 'sheets'; sheets: Array<{ name: string; rows: Cell[][] }> }
  | { format: 'pdf'; pages: Array<{ width: number; height: number;
        items: Array<{ x: number; y: number; w: number; h: number; text: string }> }> };

interface StatementReader {
  provider: ProviderId;
  id: string;                                   // 'monobank-card-uk'
  /** 0 = not mine, 1 = its format and part of its signature, 2 = its whole signature. */
  detect(doc: StatementDocument): 0 | 1 | 2;
  read(doc: StatementDocument): StatementReadResult;
}

interface ParsedStatement {                     // one per account in the file
  kind: 'card';
  currencyCode: number;
  account: { iban: string | null; cards: string[]; type: string | null };  // cards: masked numbers
  rows: Array<Omit<NormalizedTx, 'id'>>;
  closingBalance: number | null;
}
type StatementReadResult = { ok: true; statements: ParsedStatement[] } | { ok: false; problem: StatementProblem; row?: number };
```

- **Cells.** A spreadsheet cell keeps the stored value as text, never as a float. `toMinor` (moved from
  `monobank/statement.ts` to `shared/money.ts`) reads money exactly. A date cell is an Excel serial in a numeric
  cell; `shared/excel-date.ts` turns it into seconds in the statement's zone.
- **Picking.** `pickReader(doc)` in `providers/statements.ts` takes the readers whose `detect` is highest and above 0.
  None gives `unknown-format`, and two gives `ambiguous`.
- **Problem codes.** Monobank's `english` becomes the generic `language`. `other-bank` is raised by the upload when
  the reader's provider is not the connection's.
- **Monobank.** Its CSV reader is ported as is. It returns one statement with no IBAN and no cards, because the card
  statement states neither.
- **The registry.** `providers/<id>/statement.ts` exports `readers: StatementReader[]`, and the boundary test's rule
  for `providers/statements.ts` stays.
- **The core's limit.** It decodes no binary format. The text format is decoded by the caller (UTF-8, BOM stripped).

Alternative considered: **readers that get bytes and decode them themselves.** Rejected: zip and PDF code would
enter the core (purity test, bundle) and run wherever the reader runs. That is main today, the process holding the
tokens.

### 6. Writing a file: every account or none

`compareStatement` / `commitStatement` take the whole file (`ParsedStatement[]`) and an optional target per
statement.

- **Matching.** Without a target, a statement is matched to a card account of the connection:
  - by IBAN, else by one of its masked card numbers (stored `accounts.iban` / `masked_pan`);
  - else it is offered as `new`;
  - the user can change any target.
- **Comparison.** Per statement: today's counts, `blocked`, and the chosen target.
- **Commit.** It writes all accounts in one batch:
  - `commitRows` is split into building its statements and running them, so `statement-import.ts` can batch several
    accounts;
  - then it derives the merged span;
  - a new account stores the file's IBAN and masked card numbers.
- **Full pass.** It runs `rederiveCore` when derivation failed, or when the file wrote an IBAN or a card number the
  connection's accounts did not have (spec delta of `core-derived-data`). An IBAN is what lets the `iban` transfer
  rule see other banks' rows.
- **Main's side.** It keeps the read statements under one `statementId`. The renderer gets, per statement, the
  currency, the counts, the span and the account's card type and last four digits, never the IBAN.
- **Re-upload ids.** A re-upload adds only new rows through the existing ids (account, second, amount, order among
  equal rows). Minute-precision times stay correct, because equal rows in one minute differ by their order.

### 7. Cross-bank pairs: the `pair` / `pair_fee` rules, a wider window, a stored implicit fee

The pass runs in `derive/transfers.ts`, after `pair_fee`, on rows still free.

- **Which rows.** The accounts have different providers, one currency, and the same or different participants. Both
  rows are `isTransferLike` by their own provider. The debit comes first, and `0 ≤ dt ≤ CROSS_BANK_WINDOW_SEC`
  (180).
- **The difference.** `d = −debit − credit`, with `0 ≤ d` and `100·d ≤ 5·credit` (integers only).
- **Choosing.** Edges go greedily by `dt`, then `d`, then ids.
- **The rule.**
  - `d = 0` is `pair`.
  - Otherwise it is `pair_fee`, and the debit row stores `transfer_fee = d − commission` when positive. The
    commission keeps counting as «Bank fees».
  - Across participants it is `family`, as today.

  No new rule value, so the `CHECK` on `transfer_rule` (migration 16) is unchanged, and a table rebuild with
  `transaction_raw` hanging off it is avoided. Diagnostics can tell a cross-bank pair by its accounts' providers.
- **The pass window.** `markInternalTransfers` widens its context by `CROSS_BANK_WINDOW_SEC` instead of
  `TRANSFER_WINDOW_SEC`, but only when accounts of two providers exist. With Monobank alone, the context and the work
  stay as today. `deriveSpan` widens the span the same way. `tests/derived-equivalence.test.ts` gains a two-bank
  fixture.
- **Aggregates.** `spendingLinesSql` gains a third line kind, `transfer_fee`. It applies when
  `transfer_fee > 0 AND crossing_category IS NULL`, in the new category `transferFees` («комиссии за переводы»), in
  every view. The body becomes `amount + commission + transfer_fee` and stays excluded for internal and family rows
  as today. A crossing row counts its whole amount as ordinary.
- **The screen.** `home.spending.category.transferFees` is added to `uk`, `en` and `ru`.
- **No absolute floor.** A small transfer whose fee is above 5% is simply not paired, so it counts as spending and
  income, as today. That is the safe failure. Real fee data decides whether a floor is needed (`docs/backlog.md`).

Alternatives considered:
- **A new rule value `pair_bank`.** Rejected: it needs a table rebuild for one `CHECK`.
- **A fixed tariff table.** Rejected by the proposal (tariffs vary by card and funds).
- **Widening the existing 20-second window for all pairs.** Rejected: same-bank pairs would change and Monobank
  figures could move.

### 8. Decoding binary files in a short-lived `utilityProcess`

- **Main.** It reads the file (size cap: `STATEMENT_MAX_BYTES`, 10 MiB) and tells the format from the leading bytes:
  - `%PDF-` → pdf;
  - `PK\x03\x04` → xlsx;
  - otherwise UTF-8 text, decoded in main as today.
- **The decoder process.** A spreadsheet or PDF goes to `src/decoder/process.ts`:
  - forked per upload with `serviceName: 'balance-decoder'` and `env: {}`;
  - one `decode { format, bytes }` message;
  - one reply, `document` or `failure { code }`;
  - then it exits.
- **Main's checks.** It zod-checks the reply (`src/shared/decoder-protocol.ts`), including the limits. It kills the
  process after `DECODE_TIMEOUT_MS` (30 s). Then it runs `pickReader` and `read`, which are pure core code on a
  checked document.
- **Limits.** 50 sheets, 200 000 cells, 500 pages, 200 000 text items, 200 characters per item. The archive is
  refused when its declared unpacked size passes 50 MiB, which guards against zip bombs.
- **XLSX.** `fflate` (unzip, no dependencies) plus our own reader of the workbook XML with `fast-xml-parser`:
  - only `xl/workbook.xml`, `xl/sharedStrings.xml` and `xl/worksheets/*.xml` are inflated;
  - formulas are not evaluated (their cached value is read);
  - external links are never followed.
- **PDF.** `pdfjs-dist`'s legacy build with `isEvalSupported: false`, `disableFontFace: true`, no worker and no
  system fonts. Text items come back with their transform turned into x, y, w, h.
- **Versions.** Exact versions are pinned at apply time, after checking their licences and advisories (`pnpm audit`).
- **The import graph.** `tests/main-imports.test.ts` gains the rule that the decoder's graph reaches no `electron`,
  `net`, `src/data/`, `src/worker/`, `src/main/`, `@mono/db-libsql` or core outside `shared/` and
  `providers/types.ts`.
- **What it protects.**
  - A flaw in a PDF or XLSX library, hit by a crafted file, runs in a process that has no key, no token, no
    database, no network module and an empty environment.
  - It cannot reach the renderer, and its only output is checked data.
  - The renderer gets no file content (spec `desktop-statement-decoding`).

Alternatives considered:
- **Decode in main.** Rejected: main holds the tokens and the key.
- **Decode in the data process.** Rejected: it holds the database key and the open database.
- **Decode in the renderer with pdf.js.** Rejected for three reasons:
  - it would need a worker and a CSP change;
  - it would send a whole document over the bridge;
  - main would still have to check it, so nothing is gained.
- **SheetJS `xlsx` from npm.** Rejected: the npm build is no longer maintained there and carries known advisories.
- **`exceljs`.** Rejected: a large dependency tree for a read-only need.
- **`pdf-parse` or `pdf2json`.** Rejected: they wrap old pdf.js forks.

### 9. Names that stay

- `monobank.db` stays the file name. A rename would mean moving an encrypted database and its WAL on every machine
  (Windows file locks included) for a name no user sees. The constant gets a comment.
- The rates service stays `monobank-rates`. It is the source of today's rates for every bank, not a provider's half.
- The legacy `token.bin` belongs to Monobank by history, so its one place in `main/token.ts` keeps naming it.
- The proposal's list of names to remove is narrowed to `ProviderKey` (it becomes `ProviderId`), `DEFAULT_PROVIDER`
  and the renderer fallbacks. The proposal is updated to say so.

### 10. The conformance suite and the «add a bank» procedure

`packages/core/tests/providers/conformance.test.ts` runs for every id in `PROVIDER_IDS`:
- **Info.** The `ProviderInfo` shape. `api` is present exactly when `access.token` is.
- **Ids.** `ids: 'bare'` is allowed only for Monobank.
- **Rules.** Every rule answers fixture rows, with and without an MCC and a bank category, without throwing.
  `categoryHint` returns only `CATEGORY_HINTS`.
- **Readers.**
  - Each reader's fixtures live in `tests/providers/<id>/fixtures/` as JSON documents with an expected-result JSON.
    They are fictional only.
  - Each reads its fixtures to the expected result, twice with equal output.
  - `detect` gives 0 for every other provider's fixtures.
  - Stored ids carry the prefix.
- **Purity.** The source check is the existing `purity` and boundary tests.

The core-architecture skill gets a section «Add a bank»: the files to add, the registries to extend, the fixtures,
the renderer look, and the checks to run. `core-providers.md` is rewritten in English to match.

## Risks / Trade-offs

- **[A false cross-bank pair]**: a payment to someone else and an unrelated incoming transfer of the same person, in
  one currency and within 3 minutes, could pair.
  → Mitigation: both rows must be transfer-like by their providers, and the 5% tolerance and nearest-first choice
  narrow it further. Single-bank data is untouched. A live check on real two-bank data goes to `docs/backlog.md`.
- **[pdf.js in a bare Node process]**: the legacy build may warn about missing canvas polyfills.
  → Mitigation: text extraction does not need them. The first task of the decoder group is a spike test on a
  generated fictional PDF.
- **[An implicit fee where the bank shows none]**: currency rounding can make a debit 1 minor unit larger.
  → Mitigation: it is counted as a transfer fee (true to the money). The live check confirms on real data.
- **[A wider pass with two banks]**: the transfer context grows from 20 s to 180 s around each span.
  → Mitigation: it runs only when two providers exist. The performance harness gains a two-bank fixture with the
  existing budgets.
- **[A new IBAN forces a full pass on upload]**: the first upload of a bank's file costs one full re-derivation.
  → Mitigation: it happens once per new account, and later uploads stay incremental.
- **[`transfer_fee` at the row's end]**: `ADD COLUMN` puts a column read by statistics after the cold ones.
  → Mitigation: it is read only for rows that are internal or family. The performance budgets cover it.

## Migration Plan

- Migration 17 adds two nullable columns: no rebuild, no compaction, no data rewrite. With Monobank-only data every
  stored value stays the same, and `derived-equivalence` and the existing figure tests show it.
- No new figure appears until a second bank's statements exist, so nothing changes for current users.
- Rollback: an older build would not open a database at version 17. The release adds no downgrade, as for earlier
  migrations.
- Live checks for `docs/backlog.md`:
  - a real two-bank pair and its fee;
  - whether small transfers need an absolute fee floor;
  - decoding a real PrivatBank `.xlsx` and A-Bank `.pdf` by the other team, before their readers ship;
  - the decoder's memory on a large PDF.
- `CHANGELOG.md`: nothing in this change. The user-visible effects (another bank, transfers between banks, the
  transfer-fee category) appear only when the first new bank's reader lands, and that change writes the entries.

## Open Questions

- The exact pinned versions of `fflate`, `fast-xml-parser` and `pdfjs-dist`, chosen at apply time from the current
  advisories. This does not change the approach.
