# Proposal

## Why

Home's «Spending» block names only the seven biggest categories of the month and folds every other one into a single
row («8 more categories») that opens nothing. In a month with fifteen categories the user cannot see what the smaller
ones are, how much each took or how each changed — and those are often the ones worth a look.

## What Changes

- A new screen «All categories» lists every category with spending in the month the global filter shows, one row each,
  with the same figures as home's rows (amount, share, transactions, change, the bar) and the same link to the
  category's own screen.
- Home's «N more categories» row becomes a link to that screen. Home's block itself stays short: seven named
  categories, the ring and its «Other» segment are unchanged.
- The screen follows the same choices as home's block: the person and bank filters, «Personal / Business», the
  currency, and the block's own view settings.

Affected: `apps/desktop` (renderer only). User-visible: adds a `CHANGELOG.md` entry under 0.1.16. No trust anchor
changes.

Out of scope: any change to what counts as spending or to the numbers themselves; core, IPC and the database; the
ring; the «Today» and «This week» tiles; sorting or filtering controls on the new screen; a menu item of its own.

## Capabilities

### New Capabilities
- `desktop-spending-categories`: the «All categories» screen — every spending category of the month, and how home
  leads to it.

### Modified Capabilities

None.

## Impact

- Renderer: a new route and page (`pages/spending-categories`), a second feature component in
  `features/spending-summary`, a link helper in `shared/config`, three dictionaries.
- Reads the answer home already reads (`getSpendingOverview`): no new IPC method, no new query.
- Docs: `.agents/project/desktop-renderer.md`, `CHANGELOG.md`.
