# Tasks

## 1. Pending payments count in the budget and limits

- [x] 1.1 Add a failing test in `apps/desktop/tests/data.test.ts`: a pending purchase today counts in a limit's and the budget's flexible spent amount and in the note's count and amount; a cancelled hold counts nowhere
- [x] 1.2 Switch the spent grid of `limitsOverview` to every hold (`apps/desktop/src/data/data.ts`), update the comments in `data/limits.ts`; verify the new test and the existing limits tests pass
- [x] 1.3 Reword `entities.goal.pending`, `entities.goal.pendingHint`, `entities.goal.help.forecast`, `insights.health.limits.help`, `limits.intro.counted`, `limits.sheet.counted` in `uk.json`, `en.json`, `ru.json`; update renderer tests that read these texts; verify `tests/i18n.test.ts` and the renderer tests pass
- [x] 1.4 Add the «### Changed» line under `## 0.1.15 — unreleased` in `CHANGELOG.md` (flagged for human review); add to `docs/backlog.md`: after an import, today's processing purchases move the budget figure at once

## 2. Checks

- [x] 2.1 Run the desktop typecheck and vitest from `apps/desktop`; ask the user to run `pnpm test` and `pnpm typecheck` at the root

## Workflow follow-up

- The user checks the «Budget» screen after an import.
- Sync the spec and archive the change once it is committed.
