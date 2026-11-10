# Design

## Context

See proposal.md — Why. Scope is a derived column (`packages/core/src/derive/scope.ts`, `computeScope`), computed after
categories by `rescope`. Its priority: scope overrides → business account → treasury payment while
`treasury_business` is on (default on today) → personal. Settings store only non-default values
(`packages/core/src/people/settings.ts`); the desktop has no UI for this setting, the MCP side changes it with the
user-run `settings:*` script, which re-scopes everything.

The budget's «Count taxes» switch lives in the goal (`goals.count_taxes`) and is read only in
`apps/desktop/src/data/limits.ts` (the flexible part's categories) and `packages/core/src/read/goals.ts` (no taxes fixed
row while it is off). It already does what the user wants; nothing else hides taxes on its account.

Stored rows are re-derived in full when `rulesChanged` (`derive/rederive.ts`) sees a new `CATEGORY_RULES_VERSION`; the
desktop import (`worker/run-import.ts`) and the statement import check it. The MCP's own database is re-derived by
`recategorize`.

Follows `.agents/project/domain-rules.md` (scope section) and `core-layout.md` (no new module); updates
`domain-rules.md`: rule 3 «treasury → business» becomes «off by default».

## Goals / Non-Goals

**Goals:**

- Treasury payments from personal cards are personal by default, in new and in already stored rows.
- The budget switch keeps its single job; a test pins that.

**Non-Goals:**

- Removing the setting or the treasury rule; a desktop control for it.
- Re-scoping without an import (at app start).

## Decisions

### Flip the default, keep the rule

`SETTING_DEFAULTS.treasury_business` becomes `false`. The rule and the setting stay, so a user who files taxes as
business (a FOP paying its single tax from a personal card) turns it on with one command.

Alternatives: delete the rule — rejected: it removes a working option for the MCP user and its tests for no gain;
a desktop toggle — rejected for now: no screen asks for it, and it would need a new IPC and texts (out of scope).

Settings store only non-default values, so no stored row changes meaning: before, `on` was never stored (it was the
default) and `off` was stored; after, an `off` row equals the default and still reads as off.

### Re-scope through the rules version

Bump `CATEGORY_RULES_VERSION` 2 → 3 and widen its comment to «any change that can give a stored operation another
category or scope». The next desktop import then runs `rederiveCore`, which re-scopes everything.

Alternatives: a migration that re-scopes — rejected: migrations are SQL steps and cannot run `rescope` (provider rules
in code); a separate scope rules version — rejected: a second key and check for the same full pass.

For the MCP database the agent runs `pnpm --filter @mono/mcp recategorize` once after the change (allowed, unchanged).

### Budget switch untouched

`limits.ts` and `goals.ts` stay as they are. A data test in `apps/desktop/tests/data.test.ts` builds a month with a
treasury payment from a personal card and checks: personal spending and the taxes category include it; the budget's
flexible spending leaves it out with `countTaxes: false` and includes it with `true`.

## Risks / Trade-offs

- [The MCP user's personal totals grow by the taxes] → intended; the CHANGELOG line and the setting tell how to go back.
- [A user who wanted taxes as business on desktop has no control] → the setting is reachable through MCP; a desktop
  control is a later change if asked.
- [Re-scope waits for the next import] → any import (automatic, manual or a statement upload) runs it; when exactly the
  user first sees it is checked on a live system (`docs/backlog.md`).

## Migration Plan

No schema migration. The rules version bump triggers one full re-derivation at the next import; rollback is a revert
plus another version bump.
