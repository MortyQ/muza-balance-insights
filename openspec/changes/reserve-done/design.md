# Design

## Context

See proposal.md. Reserves are core `read/reserves.ts` (table `reserves`, migrations 13 and 14), read by
`DataService.allowanceOverview` and the balance card's `reserved` (`reserveFor` in `data/data.ts`); written through IPC
`addReserve` / `updateReserve` / `deleteReserve` checked by zod and core alike. Follows `.agents/project/core-layout.md`
(a migration in `storage/migrations/`, the write stays in `read/reserves.ts` like the rest of the table) and
`desktop-renderer.md` (`VCheckbox` from `shared/ui`, texts through i18n).

## Decisions

- **`done_at` timestamp, not a boolean**: the history asked for later («how many reserves were done in a month») can
  read it without another migration. Alternative: a boolean — rejected for that reason; deleting — rejected: loses the
  record.
- **Active = not done and (no end or `until` ≥ today)**: one predicate used by both readers, so the balance card and
  «Available per day» never disagree.
- **`VCheckbox` in the row**, saved at once (it changes a figure the user is looking at).

## Risks / Trade-offs

- [Old app versions ignore the column] → harmless: a downgrade counts done reserves again.
