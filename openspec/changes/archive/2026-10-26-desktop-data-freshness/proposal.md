# Proposal

## Why

«Дані до» in the header is the oldest date of all imported accounts. With a bank connected by statement file (PrivatBank,
uploaded up to 21.09) next to a live Monobank token, the header says «Дані до 21.09» although Monobank is current, and
every month figure (the month in progress, «usual up to this day», averages per day) is cut to 21.09 for the whole
family. The user cannot see which bank is behind or what to do about it.

## What Changes

- Completeness is measured over **live** accounts — those of token connections — when there are any: a statement file is
  a snapshot and no longer holds the family's figures back. With no token connection, every account counts, as today.
- The header shows «Дані до» of the live data and, when a connection is more than a day behind it, a short mark
  («PrivatBank: до 21.09»; «2 банки відстають» for several).
- Pressing the status opens a list of every connection: bank, person, way (token / file), the date its data reaches, and
  its action — «Оновити» for a token connection (the usual import), «Завантажити виписку» for a file one (the data
  screens' upload).
- `CHANGELOG.md`, next unreleased version: «The data status shows each bank: which one is behind, and how to bring it up
  to date. A bank updated by file no longer holds back the month's figures of the others».

Out of scope: per-account completeness inside one bank; reminders or notifications; automatic statement fetching.

Affected: `packages/core` (`read/filters.ts` `periodInfo`, `read/status.ts` `data_until`), `apps/desktop` (data status,
`widgets/global-filters` sync status, dictionaries). `apps/mcp` sees the same rule through the core (it has token
connections only, so nothing changes for it). No trust anchor changes. User-visible: yes.

## Capabilities

### New Capabilities
- `desktop-data-freshness`: how far the data reaches, per connection and overall, which accounts decide whether a period
  is complete, and how the header shows a connection that is behind.

### Modified Capabilities

## Impact

- Core: one query in `periodInfo` and the status's `data_until` take live accounts first.
- Desktop: `DataService.status()` (the same rule), `DataStatus` gains nothing — the per-connection dates are already in
  `ConnectionView.coveredTo` / `lastSyncAt` of the people list; `SyncStatus` gets the mark and a popover
  (`VPopover` from `shared/ui`).
