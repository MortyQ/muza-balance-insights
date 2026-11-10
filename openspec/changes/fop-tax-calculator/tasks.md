# Tasks

## 1. Data

- [x] 1.1 `DataStatus.businessAccounts` and `DataService.fopTaxOverview` (quarter and year to date over `incomeSummary` grouped by account, business accounts of the view only); IPC `getFopTaxOverview` in `channels.ts`, `ipc-args.ts`, `data-protocol.ts` (rated), `data/host.ts`, `main/index.ts`, `CACHED_READS`; verify `tests/data.test.ts` (refunds and own transfers out, only FOP accounts, quarter bounds, no FOP → unavailable), `tests/ipc.test.ts`

## 2. Screen

- [x] 2.1 `RouteNav.when` and the conditional menu item (`navGroups`, `useNav`, `useAppSidebar`); route, `pages/fop-tax`, `features/fop-tax` (quarter picker, presets, custom percent and amount, disclaimer, ЄСВ note); keys in `uk.json`, `en.json`, `ru.json`; verify `tests/renderer/fop-tax.test.ts`, `tests/renderer/layouts.test.ts`
- [x] 2.2 `CHANGELOG.md` «### FOP tax» (flagged for human review); `docs/backlog.md` live check; `.agents/project/desktop-renderer.md`, `desktop-import.md`

## 3. Checks

- [x] 3.1 Each package's typecheck and tests; the user runs `pnpm test` and `pnpm typecheck` at the root

## 4. Revision: standalone calculator

- [ ] 4.1 Data: `FopTaxQuery` → `{ from, to, base, yearToDate?, participantId? }`; «All income» over every enabled account of the view; drop `DataStatus.businessAccounts`; verify `tests/data.test.ts` (all vs FOP base, month and range bounds, refusals), `tests/ipc.test.ts`
- [ ] 4.2 Screen: the menu item always shown (drop `RouteNav.when`); period kind Month / Quarter / Year / «Dates» with their pickers; base switch; presets 5% and 6% plus own percent; keys in `uk.json`, `en.json`, `ru.json`; verify `tests/renderer/fop-tax.test.ts`, `tests/renderer/layouts.test.ts`
- [ ] 4.3 `CHANGELOG.md` «### FOP tax» reworded (flagged for human review); `.agents/project/desktop-renderer.md`, `desktop-import.md`; each package's typecheck and tests, then the root ones
