# Proposal

## Why

Refreshing a file-connected bank takes a trip into «Settings» → «Connections», picking the right connection, then the
file. With a second file bank (PrivatBank, change `core-privatbank-statements`) this becomes the usual way to update
data, and it should take one action from where the user already is.

## What Changes

- «Upload statement» on the data screens (the global filters row, next to the sync status) and dropping a file
  anywhere on a data screen's window: the same flow starts without choosing a connection first.
- The bank is told by the file itself (the existing reader pick). The file goes to that bank's file connection: the only
  one is taken at once; with several, the user picks one; with none, the user is offered to add a file connection of
  that bank right there (its name defaults to the bank's).
- Then the existing comparison per account («N new rows») and one «Write» — re-uploads already add only new rows.
- A statement of a bank connected only by token is offered as the existing reference check, never written.
- The per-connection upload in «Connections» stays as it is.
- `CHANGELOG.md`, next unreleased version: «Upload a statement from the home screen or drop it on the window; the app
  finds its bank and card by itself».

Out of scope: several files at once; uploads while the app lock is closed; new file formats (each bank's change adds its
own); editing the category tables in the UI.

Affected: `apps/desktop` (main statements service, preload, IPC contract, renderer). Not affected: `packages/core`
(the reader pick and statement import are used as they are), `apps/mcp`, `packages/db-libsql`. No trust anchor changes.
User-visible: yes (CHANGELOG entry above).

## Capabilities

### New Capabilities
- `desktop-statement-upload`: uploading a statement file from the data screens — the entry points, finding the bank and
  its connection from the file, and what the renderer may see of the file.

### Modified Capabilities

## Impact

- `src/main/statements.ts` (open without a connection, assign a connection), `src/preload` (a dropped file → main),
  `src/shared/api.ts` / `channels.ts` / `ipc-args.ts` (two methods), `src/main/ipc.ts` gates.
- Renderer: `features/statement-upload` (new slice), `widgets/global-filters`, `app/layouts/DefaultLayout.vue` (the
  drop area), dictionaries.
- Security: a dropped file's path reaches main only from the preload; the renderer never sees it
  (`.agents/project/desktop-security.md` updated).
