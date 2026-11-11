# Proposal

## Why

After an import, today's purchases are usually still being processed by the bank. The budget and the category limits
leave such payments out of «spent» and show them only as a quiet «+ N pending» note, so the main figure, the bar, the
forecast and «per day» look as if the import changed nothing. The user expects a purchase to count against the budget
as soon as it shows up.

## What Changes

- The monthly budget's flexible part and every category limit count pending payments in their spent amount at once:
  the figure, the bar, the state, the forecast and «per day» all include them. Cancelled payments never count.
- The pending note stays as a hint of how much of the spent amount the bank may still change: «incl. N pending,
  amount». Its tooltip and the help texts that said pending payments are left out are reworded.
- The same figures everywhere the budget and limits appear: the «Budget» screen, home's «Budget» row and «Limits»
  slide, the limit bar on the category screen, the limits item of «Financial health».

Out of scope: «Spending» and the other spending screens (they already count pending payments); the pending marks on
operation rows; any change to how the bank's holds are detected.

User-visible: yes. `CHANGELOG.md`, `## 0.1.15 — unreleased`, «### Changed»: purchases still processed by the bank
now count against the budget and limits right away (flagged for human review before the release).

Trust anchors: none change.

Affected: `apps/desktop` only (data process read of the «Budget» screen, renderer note texts, dictionaries, tests).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `desktop-limits-goals`: the «Budget screen» requirement — spent amounts include pending payments; the note says how
  much of it is pending.

## Impact

- `apps/desktop/src/data/data.ts` (`limitsOverview`: one grid with every hold, the pending grid kept for the note) and
  `apps/desktop/src/data/limits.ts` (comments).
- Dictionaries `uk.json`, `en.json`, `ru.json`: `entities.goal.pending`, `entities.goal.pendingHint`,
  `entities.goal.help.forecast`, `insights.health.limits.help`, `limits.intro.counted`, `limits.sheet.counted`.
- Tests: `apps/desktop/tests/data.test.ts` (limits overview with a hold), renderer tests that read the note text.
