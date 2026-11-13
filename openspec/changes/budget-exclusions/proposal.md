# Proposal

## Why

The monthly budget can leave out one thing only: taxes, with the «Count taxes» switch. Anything else the user does not
want to plan against — a one-off trip, investments, money given to family — still eats the flexible part, so the pace,
the forecast and «per day» stop describing everyday spending. And the budget screen itself is reachable only through
home's «Budget» row: it has no place in the menu.

## What Changes

- The monthly budget gets **exclusions**: a list of categories that the budget does not count. An excluded category
  is neither part of flexible spending nor a fixed cost. It stays in «Spending», in the budget structure (50/30/20)
  and under its own category limit, exactly as taxes do today.
- The «Count taxes» switch stays where it is and keeps working; under the hood taxes become one of the exclusions,
  so there is one rule and one place where it is stored.
- The budget sheet gets an «Exclude from the budget» field under the switch: pick a category, it appears as a
  removable chip. The live result and the past months' chart follow at once.
- The budget on its screen and on home names what it leaves out («Not counted: Taxes, Travel»).
- **«Budget» becomes a menu entry** of the app navigation; the screen is the existing one. Home's «Budget» row keeps
  opening it.

Affected: `packages/core` (plans, a migration), `apps/desktop` (data, IPC schema, renderer). User-visible: adds a
`CHANGELOG.md` entry under 0.1.16. No trust anchor changes; nothing new reaches the analysis copy or the MCP tools.

Out of scope: excluding single transactions or payees; exclusions for category limits or savings goals; any change to
«Spending», the 50/30/20 split or insights other than the budget's own signals; turning the budget sheet into a page.

## Capabilities

### New Capabilities

None.

### Modified Capabilities
- `core-spending-limits`: the budget's exclusions — what they take out, how they are stored and checked, taxes as one
  of them.
- `desktop-limits-goals`: the «Budget» screen is a menu entry; the sheet's exclusions field; the «not counted» note.
- `desktop-app-shell`: the menu lists «Budget».

## Impact

- Core: `read/goals.ts` (input, checks, read), a new migration (table `goal_excluded`, existing «taxes off» budgets
  moved into it); `goals.count_taxes` stays in the schema, no longer read.
- Desktop: `data/limits.ts` (flexible spending), `shared/api.ts` and `shared/ipc-args.ts` (`excluded` on the budget
  payload and view), `features/limits-goals` (sheet, panel, past months), `home-budget` (the note), the route's
  `meta.nav`, three dictionaries.
- Docs: `.agents/project/domain-rules.md`, `.agents/project/desktop-renderer.md`, `CHANGELOG.md`.
