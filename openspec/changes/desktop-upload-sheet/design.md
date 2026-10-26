# Design

## Context

See proposal.md, «Why». Today:
- `StatementsService` (`src/main/statements.ts`) keeps one opened file (`kept`) for 10 minutes;
- `openAny` reads one file, the dialog's or a dropped one;
- `assign` binds that file to one connection;
- `compare` and `commit` run on that connection with one target per account (`StatementTargetInput`: an existing
  account or a new one). Core `compareStatement` already matches an account by IBAN or card number inside a
  connection.

In the renderer:
- `QuickUploadFeature` is a centred `<dialog>` driven by `useQuickUpload` (states `problem` / `choose` / `ready`);
- `FreshnessList` is a flat `VPopover` list.

The bank registry (`entities/bank/utils.ts` over core `PROVIDERS` and `STATEMENT_READERS`) already lists the banks and
their looks.

Follows `.agents/project/desktop-import.md` (statement IPC), `desktop-security.md` (dropped paths),
`desktop-renderer.md` (FSD, «shared/ui first», i18n) and `core-people.md` (connections belong to a participant).
Updates `desktop-import.md` and `desktop-security.md`.

## Goals / Non-Goals

Goals:
- one sheet for 1–12 files;
- a target per account, found across connections;
- a file connection created in the sheet;
- the freshness panel grouped by person.

Non-goals:
- coverage gaps;
- background or queued uploads (the sheet is modal to the data screens while open);
- per-file progress beyond «reading / ready».

## Decisions

### D1. Main keeps a batch, not one file
`kept` becomes a batch: up to 12 files, one id each, under one batch id, for 10 minutes. `openAny(paths | dialog)`
reads them one by one and returns, per file, either a problem code or its accounts. The decoder process stays one at a
time. A failed file never fails the batch.

Alternative: the renderer calls `openAny` once per file. Rejected. Each call would reset `kept`, and the dialog can't
multi-select across calls.

### D2. Resolve the target in main, across connections
A new main step, `resolve`, runs for each account of each file:
1. It looks for the account's IBAN or card in the accounts of every file connection of that provider.
2. A match gives `{ connectionId, accountId }` and the connection's participant.
3. No match gives `unassigned`.

The renderer gets a participant id and a connection id, never the IBAN.

Alternative: keep `assign` per file and let the user pick a connection. Rejected. It is the friction the change
removes, and one file can hold cards of two people (PrivatBank exports several cards).

The lookup uses `connectionAccounts` per connection (few connections), so there is no new core query. If that turns
out slow, a core `read/` function «accounts by card or IBAN» is added. That is the only possible core touch.

### D3. «Whose account?» creates the connection lazily
Picking a person for an unassigned account takes that person's file connection of the bank. When there is none, the
sheet holds the choice as `{ participantId, provider }`. The connection is created by main inside `commit`, before the
write, in the same transaction scope as the existing «add connection» and with the same name rule (the bank's name).
Cancelling the sheet leaves no empty connection behind.

Alternative: create it on pick. Rejected. An abandoned sheet would leave an empty connection.

### D4. Commit per file, all or nothing per file
`commit(batchId, targets[])` writes file by file. Within a file, all of its accounts go in or none do (today's rule).
Cards still asking «Whose account?» and token-only cards are skipped. The result lists the outcome per file.
`import-running` refuses the whole batch, as today.

### D5. Bound upload
`openAny({ connectionId })` limits the dialog's extensions to that bank's readers and refuses another bank's file
(`other-bank`, today's check). The «from» date is computed in the renderer from the connection's `coveredTo` (+1 day).
Main does not need it.

### D6. Renderer placement (FSD)
- `shared/ui/components/overlay/VSheet.vue`: a side sheet from the right edge, modal (`<dialog>`), focus trapped, Esc
  closes, below 45rem it rises from the bottom. Check muzakit for a drawer first. Copy it if it exists, and record any
  divergence in `shared/ui/README.md`.
- `features/integrations/quick-upload/`:
  - `composables/useQuickUpload.ts`: the batch state machine (`idle → reading → review → writing → done`);
  - `components/UploadCard.vue`: one per account (bank monogram, «•• 4417», period, person `VSelect`, counts, state);
  - `components/UnknownFileCard.vue`;
  - `utils.ts`: the summary line;
  - `QuickUploadFeature.vue`: the drop zone and the `VSheet`;
  - `QuickUploadButtonFeature.vue`: the trigger. Both stay at the domain root.
- `widgets/global-filters/components/FreshnessList.vue`: rows grouped by `participantId`, compact action buttons
  (`size="sm"`, text «Upload from 22.09»), footer with «Add bank» (`AddBankList.vue`, from the registry) and «Upload
  statement». `utils.ts` `behindMark` gains the «N banks behind» form.
- `entities/bank`: `statementHint` key per look (`entities.bank.statementHint.<id>`).

### D7. Security
The renderer still never gets a path, a file name, an IBAN or a full card number. Several dropped paths go from the
preload to main in one call, and the preload filters to plain files (today's check per path). The new
create-connection-from-statement step is not a separate IPC method: it rides in `commit` targets as
`{ kind: 'new-connection', participantId }`. So there is no new way to create a connection outside an upload, and main
checks that the participant exists.

## Risks / Trade-offs

- [Decoder time for 12 large XLSX files] → read one at a time with a «reading 3 of 12» line; the 10 MB per-file limit stays.
- [The same card in two connections of one bank] → `resolve` picks none and asks «Whose account?» with both people
  offered. Recorded in `docs/backlog.md` to see if it happens.
- [A batch half written when a later file fails] → the per-file result says which files went in. Re-uploading adds only
  new rows, so a retry is safe.

## Migration Plan

No data migration. The IPC shapes change together with the renderer in one task group. Rollback is a revert.

## Open Questions

- The exact wording of each bank's «where to download» hint. It is written with the bank's reader. PrivatBank's is
  written in this change.
