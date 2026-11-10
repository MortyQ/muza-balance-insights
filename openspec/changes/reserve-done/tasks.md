# Tasks

## 1. Core

- [x] 1.1 Migration v22 adds `reserves.done_at`; `read/reserves.ts` reads and writes `done`; verify a core test (mark, unmark, survives reopening, still capped by `RESERVES_MAX`)

## 2. Desktop

- [x] 2.1 IPC and data process: `done` in `ReserveInput` / `ReserveView` (zod), active reserves leave done ones out in `allowanceOverview` and the balance card; verify `tests/data.test.ts`
- [x] 2.2 `ReserveRow` gets the «Done» `VCheckbox` with its tooltip, a done row dimmed; keys in `uk.json`, `en.json`, `ru.json`; verify `tests/renderer/allowance.test.ts`
- [x] 2.3 `CHANGELOG.md` «### Planning» line (flagged for human review); `docs/backlog.md` live check

## 3. Checks

- [x] 3.1 Each package's typecheck and tests; the user runs `pnpm test` and `pnpm typecheck` at the root
