# Proposal

## Why

A reserve on the planning screen keeps lowering «Free» and «Available per day» after the user has paid it or no longer
needs it; the only way out is to delete it and lose what it was. Testing asked for a «Done» mark (Notion, «Planning —
review after the budget»).

## What Changes

- Each reserve row gets a «Done» checkbox. A done reserve stops being taken off: «Free» on the balance card and
  «Available per day» update at once. It stays in the list, dimmed, and can be unmarked.
- The checkbox has a tooltip: «Mark as done when you have paid it or no longer need it. It no longer reduces Free».
- Storage: one nullable column `done_at` on `reserves` (a migration); kept in this database only, never in the analysis
  copy or an MCP tool, gone with «Delete all data» like the rest of the table.

Out of scope: the history of reserves by month, «Plan / History» tabs, moving reserves to the «Budget» screen.

User-visible: yes. `CHANGELOG.md`, the next unreleased version, «### Planning» (flagged for human review).

Trust anchors: none change.

Affected: `packages/core` (`read/reserves.ts`, a migration), `apps/desktop` (data process, IPC `updateReserve`,
`features/daily-allowance`, dictionaries, tests).

## Capabilities

### New Capabilities

- `desktop-reserves`: reserves on the planning screen — which count against «Free» and «Available per day».

### Modified Capabilities

None.

## Impact

- Migration v22: `ALTER TABLE reserves ADD COLUMN done_at INTEGER` (epoch seconds, null — active).
- `ReserveView.done`, `ReserveInput.done` through zod (`src/shared/ipc-args.ts`) and core checks.
- `reserveFor` and the active filter in `data/data.ts` leave done reserves out.
