# Tasks

## 1. Main and the contract

- [x] 1.1 `openAnyStatement(source)` and `assignStatement` in `StatementsService` with `connectionId: number | null` kept; compare/commit refuse an unassigned statement; verify `tests/statements.test.ts` cases (one / several / no connection, token-only bank, another bank's file, expired)
- [x] 1.2 IPC methods in `channels.ts`, `api.ts`, `ipc-args.ts`, gates in main; read-cache placement in `shared/api/methods.ts`; verify `tests/ipc*.test.ts`, `renderer/read-cache.test.ts`

## 2. The drop

- [x] 2.1 Preload `dropStatement(file)` through `webUtils.getPathForFile`; main accepts a path only for `source: 'drop'`, regular files only; verify a preload test and a main test with a directory and a symlink
- [x] 2.2 `.agents/project/desktop-security.md`: the dropped file's way to main

## 3. Renderer

- [x] 3.1 `features/integrations/quick-upload` sub-feature with its root files: button, drop zone, `useQuickUpload` (connection pick, add a file connection, comparison, write); texts in `uk.json`, `en.json`, `ru.json`; verify `tests/renderer/quick-upload.test.ts`, `architecture.test.ts`, `i18n.test.ts`
- [x] 3.2 The button in `widgets/global-filters`, the drop zone in `DefaultLayout`; verify `tests/renderer/layouts.test.ts`
- [x] 3.3 `CHANGELOG.md` entry; `docs/backlog.md`: try dropping real files on Windows and macOS

## 4. Integration

- [ ] 4.1 Run `pnpm test` and `pnpm typecheck` at the root (by the user if the sandbox blocks pnpm)
