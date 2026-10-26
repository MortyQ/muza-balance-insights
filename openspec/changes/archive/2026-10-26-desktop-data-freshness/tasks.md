# Tasks

## 1. Core

- [x] 1.1 `LIVE_ACCOUNT_IDS_SQL` in `read/filters.ts`; `periodInfo` and `read/status.ts` `data_until` use it; verify a test with a token and a file connection (complete up to the token's date) and one with files only, and that existing period tests pass unchanged; update `domain-rules.md`

## 2. Desktop

- [x] 2.1 `DataService.status()` with the same rule; verify a data test with both kinds of connection
- [x] 2.2 `behindConnections` and the header mark in `SyncStatus`; texts in `uk.json`, `en.json`, `ru.json`; verify `tests/renderer/app-header.test.ts` / a new `sync-status.test.ts`
- [x] 2.3 The per-connection list (popover) with refresh / upload actions; verify the actions are called
- [x] 2.4 `CHANGELOG.md` entry

## 3. Integration

- [x] 3.1 Run `pnpm test` and `pnpm typecheck` at the root (by the user if the sandbox blocks pnpm)
