# Design

## Context

Follows `.agents/project/domain-rules.md` (periods, completeness), `desktop-renderer.md`, `core-people.md`. Today
`periodInfo` (`read/filters.ts`) and the status (`read/status.ts`, desktop `DataService.status()`) take
`MIN(newest_synced_time)` over enabled accounts. Per-connection reach is already listed: `ConnectionView.coveredTo`
(the minimum over that connection's imported accounts) and `lastSyncAt`.

## Decisions

1. **Live accounts first, one SQL fragment.** A shared `LIVE_ACCOUNT_IDS_SQL` (core `read/filters.ts`): enabled
   accounts of token connections if any of them is imported, else every enabled account. `periodInfo`, the core
   status's `data_until` and the desktop status use it. Alternative — the freshest connection (MAX over connections):
   rejected, a token import that failed would then hide behind a fresh one and the figures would claim days nobody
   imported. Alternative — an option threaded through every `read/*` call: rejected, eight callers for one rule.
2. **Behind = more than one day.** A connection is behind when its `coveredTo` is earlier than the live date minus one
   day (a token import a few hours old is not «behind»). Computed in the renderer from the people list
   (`widgets/global-filters/utils.ts`, `behindConnections`), no new IPC.
3. **The list** is a `VPopover` anchored to `SyncStatus`. Rows reuse the bank look (`entities/bank`) and the person's
   label; the token action calls the existing import start (as the menu does), the file action calls
   `QuickUploadFeature`'s `pick` through `features/integrations` (the widget composes it).

## Risks / Trade-offs

- [A file connection's rows after the live date never exist] → the figures are true to the data; the mark says why the
  bank looks low.
- [MCP] → it has token connections only: unchanged.
