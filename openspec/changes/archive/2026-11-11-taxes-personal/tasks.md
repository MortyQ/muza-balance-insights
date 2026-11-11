# Tasks

## 1. Taxes personal by default (core)

- [x] 1.1 Set `treasury_business` default to `false` in `packages/core/src/people/settings.ts` (comment updated); update the defaults test in `apps/mcp/tests/scope.test.ts` and add a `computeScope` case: treasury from a personal card with defaults → personal, from a FOP account → business; verify `apps/mcp` vitest passes
- [x] 1.2 Bump `CATEGORY_RULES_VERSION` to 3 in `packages/core/src/derive/categories.ts` and widen its comment to scope changes; verify `packages/core/tests/derive/rederive-spans.test.ts` (`rulesChanged`) and the core vitest run pass
- [x] 1.3 Update `.agents/project/domain-rules.md` (scope rule 3: off by default) and add the `CHANGELOG.md` «### Fixed» line under `## 0.1.15 — unreleased` (flagged for human review); verify both read correctly

## 2. Budget switch pinned (desktop)

- [x] 2.1 Add a data test in `apps/desktop/tests/data.test.ts`: a treasury payment from a personal card counts in personal spending and the taxes category; the budget's flexible spending leaves it out with «Count taxes» off and includes it when on; verify the desktop vitest run passes
- [x] 2.2 Add to `docs/backlog.md`: after the first import with this version, past taxes from personal cards show in «Spending»; verify the entry is there

## 3. Checks

- [x] 3.1 Run each package's typecheck and vitest from its folder (core, mcp, desktop), then `pnpm --filter @mono/mcp recategorize` once to re-scope the MCP database; ask the user to run `pnpm test` and `pnpm typecheck` at the root

## Workflow follow-up

- The user checks «Spending» and the budget in the app after an import.
- Sync the spec and archive the change once it is committed.
- Add the Notion work-log row once pushed.
