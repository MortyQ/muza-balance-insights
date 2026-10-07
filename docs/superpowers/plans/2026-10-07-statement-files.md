# Statement files Implementation Plan

> **For agentic workers:** Steps use checkbox (`- [ ]`) syntax for tracking. Work goes task by task; `pnpm test` and
> `pnpm typecheck` (with `--config.verify-deps-before-run=false`) before each commit.

**Goal:** connect a bank by a statement file instead of a token: the user picks the bank and the «Statement file» way,
then uploads a CSV whenever they want fresh data. First (and reference) format: the Monobank card statement in
Ukrainian.

**Architecture:** a connection gets a way of access (`connections.method`: `token | file`). A file connection has no
token and no sync; its accounts are filled by uploads. The provider's rules stay the provider's: a Monobank file goes
through the Monobank rules exactly like the API rows. The core parses text (no file system); main opens the file
through the system dialog and never hands a path or the content to the renderer. Every upload is first compared with
the account (counts only), then written in one transaction followed by the usual derivation passes.

**Tech stack:** TypeScript, `@mono/core` (pure), Electron main + zod IPC, Vue renderer (FSD), vitest.

**Out of scope (later steps):** the FOP statement (needs its Ukrainian header), the English statement (descriptions are
translated, the rules would miss them — refused with a hint), XLS / PDF, other banks, drag and drop, merging a token
account with a file account.

---

## Facts the plan is built on

From the user's own statements, header lines only (no operations were read):

- Card statement, Ukrainian: one header line, then rows; columns
  `Дата i час операції, Деталі операції, MCC, Сума в валюті картки (UAH), Сума в валюті операції, Валюта, Курс,
  Сума комісій (UAH), Сума кешбеку (UAH), Залишок після операції`. The «i» in the first column may be Latin.
- Card statement, English: `Date and time, Description, MCC, Card currency amount, (UAH), Operation amount, Operation
  currency, Exchange rate, Commission, (UAH), Cashback amount, (UAH), Balance`. Service texts are translated
  (`From: …` instead of `Від: …`).
- Values: `30.09.2026 19:05:03` (Kyiv time, seconds present); amounts with a dot and a varying number of decimals
  (`530.0`, `0.95`); a minus on debits; an absent value is `—`. Comma-separated, quotes around text with spaces.
- The card currency is in the column names (`(UAH)`); the file names no account (no IBAN, no card number).
- FOP statement (English): a title line with the holder and the IBAN, then multi-line quoted column names, no MCC.

Assumptions still to confirm against a real file (the reference check in Task 9 does it): the card amount already
includes the commission (as in the API); newest rows first (the parser does not depend on the order).

Fixtures (invented data only): `packages/core/tests/providers/monobank/fixtures/statement-card-uk.csv`,
`statement-card.csv` (English), `statement-fop.csv`.

---

## Task 0: keep statements out of git

**Files:** Modify `.gitignore`.

- [ ] Add `*.csv` and `!packages/core/tests/**/fixtures/*.csv`. Check with `git check-ignore -v` on a made-up
      `docs/x.csv` (ignored) and on the three fixtures (not ignored).
- [ ] Commit `chore: ignore csv files outside test fixtures` together with the fixtures.

## Task 1: core — the way of access (migration v15)

**Files:**
- Modify: `packages/core/src/db.ts` (migration 15), `packages/core/src/participants.ts` (`ConnectionInfo.method`,
  `addConnection(db, participantId, provider, nowSec, method = 'token')`), `packages/core/src/connections.ts`
  (`ensureDefaultConnection` looks at `method = 'token'` only — the MCP server's `.env` token and an older version's
  `token.bin` must never land on a file connection).
- Test: `packages/core/tests/db.test.ts` (migration list), `packages/core/tests/participants.test.ts`,
  `packages/core/tests/connections.test.ts`.

```sql
-- v15 'connection_method': how a connection gets its data; existing ones are token connections.
ALTER TABLE connections ADD COLUMN method TEXT NOT NULL DEFAULT 'token' CHECK (method IN ('token', 'file'))
```

- [ ] Tests first: migration applies and old rows read `token`; `addConnection(..., 'file')` round-trips through
      `listConnections`; `ensureDefaultConnection` with one token and one file Monobank connection returns the token
      one, and with only a file connection creates a token one.
- [ ] Implement, run, commit `feat(core): a connection's way of access`.

## Task 2: core — the statement parser contract and the CSV reader

**Files:**
- Create: `packages/core/src/csv.ts` — `parseCsv(text): string[][]` (RFC 4180: quoted fields with commas, `""` and line
  breaks; CRLF / LF; a leading BOM dropped; trailing empty line ignored).
- Modify: `packages/core/src/providers/types.ts` — the contract:

```ts
/** What a statement file turned out to be. */
export type StatementKind = 'card';

export interface ParsedStatement {
  kind: StatementKind;
  /** The account currency, from the file. */
  currencyCode: number;
  /** Oldest first; `id` is set by the importer (statementRowIds), not by the parser. */
  rows: Array<Omit<NormalizedTx, 'id'>>;
  /** The balance after the newest row, when the file states it. */
  closingBalance: number | null;
}

/** Why a file was not taken: a code the UI words. */
export type StatementProblem = 'unknown-format' | 'english' | 'unsupported-kind' | 'empty' | 'bad-row';

export interface StatementFileParser {
  parse(text: string): { ok: true; statement: ParsedStatement } | { ok: false; problem: StatementProblem; row?: number };
}
```

  `ProviderRules` is not touched: the parser is a third, optional half of a provider (`providers/<id>/statement.ts`),
  listed in a registry `providers/statements.ts` (`statementParserOf(provider): StatementFileParser | null`).
- Test: `packages/core/tests/csv.test.ts`.

- [ ] Tests first for `parseCsv`: the fixtures' quoting (`"Кава ""Тест"", Київ"`), the FOP fixture's multi-line
      header cells, CRLF, BOM.
- [ ] Implement, run, commit `feat(core): a csv reader`.

## Task 3: core — the Monobank card statement

**Files:**
- Create: `packages/core/src/providers/monobank/statement.ts`.
- Modify: `packages/core/src/providers/statements.ts` (registry), `packages/core/tests/providers-boundary.test.ts` if it
  lists provider files.
- Test: `packages/core/tests/providers/monobank/statement.test.ts`.

Rules of the parser:
- Header recognition by normalised column names (lower case, whitespace runs → one space, Latin `i` → `і`). Ukrainian
  card header → parse; the English card header → `english`; the FOP title line (starts with a holder line, either
  language) → `unsupported-kind`; anything else → `unknown-format`. No rows → `empty`.
- Card currency from `(UAH)` / `(USD)` / `(EUR)` in the amount column name (ISO numeric through `currency.ts`).
- Time: `dd.MM.yyyy HH:mm:ss` in Europe/Kyiv → unix seconds (`@date-fns/tz`, as the rest of the core).
- Money: a string to minor units without floating point (`-845.5` → `-84550`, `0.95` → `95`, `530.0` → `53000`);
  more than two decimals or anything else → `bad-row` with the row number. `—` → absent.
- Row → `NormalizedTx` fields: `amount` (card amount), `operationAmount`, `currencyCode` (operation currency;
  `UAH` → 980 …), `mcc`, `description`, `commissionRate` (the fee column — the API's name for the fee amount),
  `cashbackAmount`, `balance`, `hold: false`, `raw` = the row as JSON (column name → cell). Nothing is guessed: an
  absent cell stays absent.
- `closingBalance` = the balance of the newest row.

- [ ] Tests first, on the fixtures: the Ukrainian card gives five rows with exact minor units and times; the USD row
      has `operationAmount: -1040`, `currencyCode: 840`; `—` leaves fields absent; the English fixture → `english`;
      the FOP fixture → `unsupported-kind`; a row with `12.345` → `bad-row` and its number; header only → `empty`.
- [ ] Implement, run, commit `feat(core): read a Monobank card statement`.

## Task 4: core — compare and commit an upload

**Files:**
- Create: `packages/core/src/statement-import.ts`.
- Modify: `packages/core/src/sync.ts` — move the body of `commitWindow` after the fetch into an exported
  `commitRows(db, { provider, accountId, window, items, nowSec, cancelHolds, warn })`; `commitWindow` calls it with
  `cancelHolds: true` (behaviour unchanged, the existing sync tests guard it).
- Test: `packages/core/tests/statement-import.test.ts`.

```ts
/** Ids of a file's rows: the account, the second, the amount, and the order among equal ones (time + amount). */
export function statementRowIds(accountId: string, rows: ReadonlyArray<{ time: number; amount: number }>): string[];

export type StatementTarget =
  | { kind: 'account'; accountId: string }
  | { kind: 'new'; id: string; type: string | null };

export interface StatementComparison {
  rows: number;
  /** Same second and amount as a stored row of the account. */
  matched: number;
  /** Matched by second, but the amount differs. */
  amountDiffers: number;
  added: number;
  /** Stored rows of the account inside the file's span that the file does not have. */
  missingInFile: number;
  /** Seconds the account's covered span and the file's span do not reach (a hole), or null. */
  gap: { from: number; to: number } | null;
  /** Written only to a file connection's account of the same currency, without a hole. */
  writable: boolean;
}

export async function compareStatement(db: Db, connectionId: number, statement: ParsedStatement, target: StatementTarget): Promise<StatementComparison>;

/** One transaction: the account (new, or its balance), the rows, the coverage; then the derivation passes. */
export async function commitStatement(db: Db, connectionId: number, statement: ParsedStatement, target: StatementTarget, nowSec: number): Promise<{ added: number }>;
```

Rules:
- Matching is a multiset match on `(time, amount)`; ids are not compared (an API row has the bank's id).
- `writable` is false for a token connection (the reference check reads, never writes), for another currency, for a
  hole, and for an account of another connection.
- A new account: `kind 'card'`, `type` from the user's pick (Monobank card types; `null` allowed), the file's
  currency, no IBAN / card number, `balance = closingBalance ?? 0`, `updated_at` = the newest row's time (so the
  month-end balance rule in `status.ts` reads it as the balance at that moment).
- An existing account: the balance and `updated_at` move only when the file's newest row is newer than `updated_at`.
- Coverage: `sync_state` grows to the file's span (oldest … newest row); a file that would leave a hole is refused
  (`gap`), same as `commitWindow`.
- Rows the account has but the file does not are left alone (reported as `missingInFile`).
- Rows go through `commitRows` with `cancelHolds: false`: categories, transfers, refunds and scope as for the API.

- [ ] Tests first: ids stable across two uploads and distinct for two equal rows; the same file twice adds nothing;
      an overlapping second file adds only its new rows; a token account compares (`matched` = the API rows made from
      the same invented data) but is not writable; a hole is refused; a different currency is refused; the balance and
      `updated_at` of a new account; the own transfer and the `Від:` row get the same categories as API rows.
- [ ] Implement, run, commit `feat(core): compare and write a statement file`.

## Task 5: main — file connections and the upload

**Files:**
- Create: `apps/desktop/src/main/statements.ts` — `StatementsService`.
- Modify: `apps/desktop/src/main/integrations.ts` (`addConnection` with `method: 'file'`: no token, no vault),
  `apps/desktop/src/main/data.ts` (`connections()` returns token connections only — the import, auto-sync and resume
  never see a file connection), `apps/desktop/src/main/index.ts` (wiring, the dialog dependency),
  `apps/desktop/src/shared/api.ts`, `apps/desktop/src/shared/channels.ts`, `apps/desktop/src/main/ipc.ts`,
  `apps/desktop/src/preload/index.ts` if methods are listed there.
- Test: `apps/desktop/tests/statements.test.ts`, `apps/desktop/tests/ipc.test.ts`, `apps/desktop/tests/integrations.test.ts`.

IPC (each with a zod tuple):
- `addConnection` input gains `method: 'token' | 'file'`; `token` is required for `token` and absent for `file`
  (a discriminated union).
- `openStatement(connectionId)` → main shows the open dialog (`.csv` only), reads at most 10 MiB, decodes UTF-8 (BOM
  dropped), parses with the connection's provider parser and keeps the result in memory under a random id (one at a
  time, dropped on a new open, on the app lock and after 10 min). Reply: `{ statementId, rows, from, to, currencyCode,
  accounts }` (`accounts` — the connection's accounts in that currency, as in «Accounts»: type, currency, card tail) or
  `{ cancelled: true }` or `{ problem: StatementProblem }`.
- `compareStatement(statementId, target)` → `StatementComparison` with dates instead of seconds.
- `commitStatement(statementId, target)` → `{ added }`; refused while an import runs; drops the kept statement.
- The path, the file name and the text never leave main and are not logged; the log line is `[statement] <problem>` or
  `[statement] added <n>`.

- [ ] Tests first: a file connection is created without touching the vault; `connections()` skips it; the size limit;
      a cancelled dialog; a problem code passes through; an unknown or expired `statementId` is refused; IPC schemas
      reject extra fields and a token on a file connection.
- [ ] Implement, run, commit `feat(desktop): upload a statement file in main`.

## Task 6: renderer — choosing the way

**Files:**
- Modify: `apps/desktop/src/renderer/src/entities/bank/{types,constants}.ts` (`auth` → `ways: ReadonlyArray<BankAuth>`,
  Monobank `['token', 'file']`), `features/integrations/AddConnectionFeature.vue` and `shared/components/BankPicker.vue`
  (after the bank: «Token» / «Statement file», each with one line on how it works and what it lacks: no auto-sync),
  `features/integrations/shared/components/ConnectionRow.vue` (a file connection: «Data up to {date}» and «Upload
  statement» instead of the token actions).
- Test: `apps/desktop/tests/renderer/integrations.test.ts` (or the existing connections tests).

- [ ] Tests first: Monobank offers both ways; picking «Statement file» adds a connection with `method: 'file'` and no
      token step; a file connection row shows the upload button and no token badge.
- [ ] Implement, i18n keys in uk / en / ru, run, commit `feat(desktop): connect a bank by statement file`.

## Task 7: renderer — the upload dialog

**Files:**
- Create: `apps/desktop/src/renderer/src/features/integrations/statement-file/` — `StatementUploadFeature.vue`,
  `composables/useStatementUpload.ts`, `constants.ts` (where to download the statement in the Monobank app, in
  Ukrainian), `types.ts`.
- Test: `apps/desktop/tests/renderer/statement-upload.test.ts`.

Flow: «Upload statement» → the system dialog (main) → the account step (an existing card of that currency, or «New
card» with the card type) → the comparison («In the file 120 · already here 80 · new 40»; a hole or a currency mismatch
as a reason) → «Add» (disabled when not writable). Problems are worded per code; `english` explains how to download the
statement in Ukrainian. The same dialog opens from a token connection's account for the check (comparison only, no
«Add»).

- [ ] Tests first: each problem code shows its text; the comparison numbers; «Add» disabled for a token account and
      for a hole; a successful add reloads quietly (`syncStatus.version` or the connection list).
- [ ] Implement, i18n, run, commit `feat(desktop): the statement upload dialog`.

## Task 8: docs and changelog

**Files:** `CHANGELOG.md` (`## 0.1.10 — unreleased`: connect Monobank by a statement file; flagged for human review),
`.agents/project/core-providers.md` (the parser half, the registry), `.agents/project/core-people.md` (`method`,
`ensureDefaultConnection` token only), `.agents/project/desktop-import.md` (file connections are outside the import),
`.agents/project/desktop-security.md` (the file is read in main only, limits, nothing logged), `docs/backlog.md`
(FOP, English, other banks).

- [ ] Write, run the full `pnpm test` and `pnpm typecheck`, commit `docs: statement files`.

## Task 9: the reference check (the user)

- [ ] The user downloads a Ukrainian card statement for a period the token already covers, opens «Upload statement» on
      that card and reports the numbers only: `rows`, `matched`, `amountDiffers`, `added`, `missingInFile`.
      Expected: `matched = rows`, the rest 0. Anything else → a fix in Task 3 / 4 before the PR.
