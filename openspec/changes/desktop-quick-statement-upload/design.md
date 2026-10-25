# Design

## Context

Follows `.agents/project/desktop-security.md` (statement files, IPC gates — updated for the drop), `desktop-import.md`,
`desktop-renderer.md` (FSD, `shared/ui` first, i18n) and the specs `core-statement-readers`,
`desktop-statement-decoding`. Today `StatementsService.open(connectionId)` (main) shows the open dialog with the
connection's readers' extensions, decodes, picks the reader, refuses another bank, keeps the statements for compare and
commit. The renderer flow lives in `features/integrations/statement-file` (`useStatementUpload`).

## Goals / Non-Goals

**Goals:** one action from home; the bank and connection from the file; same guarantees as today (main-only file
access, one kept file, 10 minutes, dropped on lock).

**Non-Goals:** batch uploads; changing the comparison or commit rules.

## Decisions

1. **Main: open without a connection.** `openAnyStatement(source)` where `source` is `dialog` or `drop`. The dialog
   offers every reader's extensions, then «All files». After the pick, the result adds `provider` and the file
   connections of that provider (`{ id, name }[]`) plus whether a token connection of it exists. The kept entry gets
   `connectionId: number | null`; `assignStatement(statementId, connectionId)` checks the connection is of the file's
   provider and sets it (a token connection is allowed only for compare, as today). `compare` / `commit` refuse a kept
   statement with no connection. Alternative — make the renderer pick the connection first by guessing from the
   extension: rejected, the bank is known only after reading.

2. **The drop.** The preload exposes `dropStatement(file: File)`: it calls Electron's `webUtils.getPathForFile` in the
   preload and sends the path on the `openAnyStatement` channel with `source: 'drop'`; the renderer's API never
   carries a path. Main accepts a path only with `source: 'drop'`, checks it is a regular file (no directory, no
   symlink out) and reads it through the same `readLimited`. A `File` built by page script has no path (empty string)
   → `unreadable`. Navigation by drop stays blocked (the window already denies `will-navigate`). Alternative — read
   the bytes in the renderer and send them: rejected, the renderer would hold the content.

3. **Renderer.** A new slice `features/statement-upload` (`StatementUploadButton`, `StatementDropZone`,
   `useQuickUpload`): it drives open → (pick or add connection) → compare → commit, reusing the comparison view of
   `features/integrations/statement-file` (moved to `shared/ui` or exposed by that slice's public API, whichever the
   FSD check allows — decided in task 3.1). `widgets/global-filters` hosts the button; `DefaultLayout` hosts the drop
   zone (an overlay while a file is dragged over). Adding a connection reuses `addConnection` with `method: 'file'`.

4. **Gates.** Both new methods are writes for the read cache only when they commit (they do not); they are blocked
   under the lock and with a database that is not ready (not in `ALLOWED_WHEN_LOCKED` / `ALLOWED_WHEN_DB_UNAVAILABLE`);
   args are checked in `ipc-args.ts`.

## Risks / Trade-offs

- [A dropped file arrives while another is kept] → the new one replaces it, as a new pick does today.
- [`webUtils` path in the preload] → the preload stays the only place; `tests/architecture.test.ts` gets a check that
  no renderer module mentions a path field of the drop.
- [Drop on the settings screens] → the drop zone lives in the default layout only; elsewhere a drop does nothing.
