# Tasks

## 1. Data

- [x] 1.1 `DataStatus.businessAccounts` and `DataService.fopTaxOverview` (quarter and year to date over `incomeSummary` grouped by account, business accounts of the view only); IPC `getFopTaxOverview` in `channels.ts`, `ipc-args.ts`, `data-protocol.ts` (rated), `data/host.ts`, `main/index.ts`, `CACHED_READS`; verify `tests/data.test.ts` (refunds and own transfers out, only FOP accounts, quarter bounds, no FOP → unavailable), `tests/ipc.test.ts`

## 2. Screen

- [x] 2.1 `RouteNav.when` and the conditional menu item (`navGroups`, `useNav`, `useAppSidebar`); route, `pages/fop-tax`, `features/fop-tax` (quarter picker, presets, custom percent and amount, disclaimer, ЄСВ note); keys in `uk.json`, `en.json`, `ru.json`; verify `tests/renderer/fop-tax.test.ts`, `tests/renderer/layouts.test.ts`
- [x] 2.2 `CHANGELOG.md` «### FOP tax» (flagged for human review); `docs/backlog.md` live check; `.agents/project/desktop-renderer.md`, `desktop-import.md`

## 3. Checks

- [x] 3.1 Each package's typecheck and tests; the user runs `pnpm test` and `pnpm typecheck` at the root
