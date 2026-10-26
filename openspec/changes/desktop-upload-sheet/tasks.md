# Tasks

## 0. Precondition

- [x] 0.1 Archive `desktop-quick-statement-upload` and `desktop-data-freshness` once the user confirms their final test run; verify `openspec/specs/desktop-statement-upload` and `openspec/specs/desktop-data-freshness` exist and `pnpm openspec validate desktop-upload-sheet` passes

## 1. Main: batch, resolve, commit per file

- [x] 1.1 `src/main/statements.ts`: the batch of up to 12 files (D1). `openAny` reads dropped paths or a multi-select dialog, or a bound connection's extensions only (D5). It returns a result per file: problem code or accounts. Verify with cases in `tests/statements.test.ts`: 3 files with one unknown, 13 files refused, a bound upload refusing another bank
- [x] 1.2 `resolve` (D2): each account → a matched connection and person, or `unassigned`. Verify with tests: a known card, a new card, cards of two people in one file, the same card in two connections → `unassigned`
- [x] 1.3 `commit` per file, with the `new-connection` target (D3, D4). Verify with tests: two ready files and one waiting, a connection created only on commit, an unknown participant refused, `import-running` refusing the batch, nothing created when cancelled
- [x] 1.4 IPC: `api.ts`, `channels.ts`, `ipc-args.ts`, the `ipc.ts` gates, and the preload passing several dropped paths (D7). Verify with the IPC args tests and the preload test (paths never reach the renderer)

## 2. Sheet overlay

- [x] 2.1 `shared/ui` `VSheet` (D6): from muzakit if it has a drawer, else ours, noted in `shared/ui/README.md`. Verify with a renderer test: opens modal, Esc closes, focus returns to the trigger, bottom sheet below 45rem

## 3. Upload sheet

- [x] 3.1 `useQuickUpload` batch state machine and `UploadCard` / `UnknownFileCard` (D6). Person select prefilled or «Whose account?». Summary line. «Import». New keys in uk/en/ru. Verify with `tests/renderer/quick-upload.test.ts`: multiple files, an unknown file, a waiting card skipped on import, a token-only card read-only, the bound «from» date
- [x] 3.2 Drop zone and button open the sheet. The old dialog and `ConnectionChoice` are removed. Verify the drop and button tests and `tests/i18n.test.ts`

## 4. «Data by bank» panel

- [x] 4.1 `FreshnessList` grouped by person, compact «Refresh» / «Upload from <date>» opening the bound sheet; `behindMark` «N banks behind». Verify with `tests/renderer/freshness.test.ts`
- [x] 4.2 «Add bank» list from the registry with each bank's way and `statementHint` (PrivatBank's hint written); a file bank opens the sheet for its files. New keys in uk/en/ru. Verify with a renderer test and `tests/i18n.test.ts`

## 5. Docs

- [ ] 5.1 `.agents/project/desktop-import.md` (statement IPC), `.agents/project/desktop-security.md` (several dropped paths), root `CLAUDE.md` (home filters paragraph), `CHANGELOG.md` 0.1.11 (the two entries of the proposal), `docs/backlog.md` (a card in two connections; 12 large files on a live machine)

## 6. Integration

- [ ] 6.1 Run `pnpm test` and `pnpm typecheck` at the root (by the user if the sandbox blocks pnpm)
