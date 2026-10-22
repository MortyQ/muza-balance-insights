# Proposal

Change 2 of the backend refactor (change 1: `core-read-model`, archived; change 3: `provider-modules`).

## Why

The Electron main process runs every database read and write of the screens itself, and libsql executes a statement
synchronously under its async wrapper (`@libsql/client` → `executeStmt`). While a statement runs, main handles nothing
else: no window events, no menu, no IPC, no pushes. Most reads are short, but some writes are not. Turning an account on
or off and removing a connection re-derive everything (about 1.5 s on the bench's year of data). A statement upload
commits and derives its span. A twelve-month analytics read takes about 43 ms per call. The window freezes for the
length of each one. The import already runs in its own process. The rest of the database work should follow it, before
change 3 adds banks and more data.

Screens also ask main again for answers they already had. Switching a month back, or reopening a category, sends the
same request with the same data version.

## What Changes

- **A data process.** One long-lived `utilityProcess` owns the app's database connection for everything except the
  import:
  - all of today's `DataService` (the overviews, status, reserves, recurring marks);
  - the database parts of `PeopleService`, `IntegrationsService` and `StatementsService`.
- **Main keeps the gates and the secrets.**
  - Main keeps the IPC gates (sender → lock → database state → zod), `DbAccess` (the launch decision and the encryption
    of a plain database), the token vault, the dialogs and the parsing of a statement file.
  - It forwards each validated call to the data process over a closed list of methods. There is no generic "run SQL"
    message.
- **Lifecycle.**
  - Main starts the data process once the database is ready and passes it the key in a message, as it does for the
    import worker.
  - It sends today's rates ahead of an overview call whenever they changed.
  - After a crash it starts the process again on the next call.
  - Before «Delete all data» and «Start over» it stops the process and waits for it to exit.
- **No query work in main.** Main no longer imports the core's database modules at run time: no `read`, `derive`,
  `ingest`, `commands`, `people` or `storage` code. An architecture test checks this.
- **A read cache in the renderer.**
  - Answers of the data screens are kept in memory, keyed by the method, its arguments and a data generation.
  - **Same generation and fresh:** shown without a request.
  - **Older:** shown at once and reloaded quietly.
  - **Writes and imports:** every write call and every data refresh (an imported window, the end of an import) moves
    the generation on.
  - **Bounds:** limited in size and age, never written to storage, gone on the lock's reload.
- The import worker, the core and the MCP server do not change.

## Capabilities

### New Capabilities

- `desktop-data-process`: where the desktop app's database work runs:
  - the data process and its closed method list;
  - what stays in main;
  - its start, restart and stop;
  - the guarantee that main runs no query work.
- `desktop-read-cache`: how the renderer reuses answers of the data screens: the key, the generation, freshness,
  bounds, and what clears it.

### Modified Capabilities

None. `core-derived-data` and `core-query-performance` keep their requirements: the same core code runs, in another
process.

## Impact

- **`apps/desktop`:**
  - **New:** `src/data/` (the process entry and its handler table); `DataService` and its helpers move there from
    `src/main/`.
  - **New:** `src/shared/data-protocol.ts` (the messages, zod-checked on both sides) and `src/main/data-client.ts`.
  - **Rewired:** `src/main/index.ts`, `people.ts`, `integrations.ts`, `statements.ts`, `wipe.ts`, `db/start-over.ts`,
    `importer.ts`, `auto-sync.ts`.
  - **Renderer:** `shared/api` (the cache and its generation), `shared/lib/useAsyncData` (start from a cached answer),
    the data features' composables, and the sync-status store (it moves the generation).
  - **Tests:** the existing main tests follow the moved files; new tests cover the protocol, the client, the host and
    the cache; the architecture test gains the main-imports rule.
- **Not affected:** `packages/core`, `packages/db-libsql` and `apps/mcp`.
- **Trust anchors:** none change. The new process is built by electron-vite through `?modulePath`, like the import
  worker, so `release.yml` and the package checks stay as they are.
- **Out of scope:**
  - The launch decision and the encryption of an existing plain database (`DbAccess`, `db/encrypt.ts`) stay in main.
    They run once, before the window exists.
  - Parsing a statement file stays in main.
  - The import worker is not merged into the data process.
  - No prefetching of screens, no persisted cache.
  - Nothing of change 3 (provider modules, file readers).
- **User-visible: yes.** `CHANGELOG.md`, under `## 0.1.10 — unreleased`, gains an entry in plain words: the window
  stays responsive while the app recalculates (turning an account on or off, removing a connection, uploading a
  statement), and screens you go back to open at once.
