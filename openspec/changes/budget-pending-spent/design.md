# Design

## Context

See proposal.md — Why. `DataService.limitsOverview` (`apps/desktop/src/data/data.ts`) reads two day grids per owner:
`holds: 'final'` for spent and `holds: 'pending'` for the note (`pendingOf` in `data/limits.ts`). Core's `holdsWhere`
treats `'all'` as no hold filter; cancelled rows are left out by the spending reads whatever the hold filter. Every
place that shows budget or limit figures (the «Budget» screen, home's row and «Limits» slide, the category screen's
bar, «Financial health») reads this one answer.

Follows `.agents/project/desktop-renderer.md` (interface texts through the dictionaries); no `.agents/project` rule
changes.

## Goals / Non-Goals

**Goals:** spent = final + pending in every budget and limit figure; the note keeps saying how much of it is pending.

**Non-Goals:** a setting to choose either way; changing the note's look or place.

## Decisions

- **Spent grid with every hold.** The spent grid switches to `holds: 'all'`; the pending grid stays as it is and only
  feeds the note. Alternative: add pending to final in `figures()` — rejected: two places to keep in step and the same
  two queries anyway.
- **Note wording, same keys.** `entities.goal.pending` becomes «incl. {n} pending, {amount}» (uk / ru likewise) and its
  hint says the bank may still change these amounts; the help texts that said pending payments are left out say they
  count. Keys stay, so the renderer code does not change.

## Risks / Trade-offs

- [A hold's amount changes or is cancelled later] → the figure moves at the next import; the note says so.
- [Limits look more often exceeded early in the day] → intended: that is what the user has spent.
