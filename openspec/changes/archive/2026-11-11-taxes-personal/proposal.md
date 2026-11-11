# Proposal

## Why

A tax paid to the state treasury from a personal card disappears from «Spending», the category screens and «Budget
structure»: the treasury rule marks it business by default, and every personal view leaves business rows out. The user
expects taxes there like any other spending; only the monthly budget's own «Count taxes» switch decides whether they
count against the budget's flexible part. The switch's hint already promises this («They still count in «Spending»»),
but the scope rule breaks the promise.

## What Changes

- Treasury payments from personal cards count as **personal** by default: the setting `treasury_business` defaults to
  off. They show in «Spending», in the «Taxes and government fees» category, in category limits and «Budget
  structure». **BREAKING** for the MCP tools' default output: personal spending now includes these taxes.
- The setting stays: the user can turn it back on with the existing user-run settings command; scope overrides keep
  working in both directions.
- Rows already stored are re-scoped once: the derivation rules version is bumped, so the next import (desktop) runs a
  full re-derivation; the MCP database is re-derived by `recategorize`.
- The budget's «Count taxes» switch is unchanged: it decides only whether taxes count against the flexible part of the
  monthly budget (and whether taxes can be a fixed row). It does not hide taxes anywhere else.
- Payments from a business account (Monobank: FOP) stay business; this change does not touch that rule.

Out of scope: a per-payment scope toggle in the desktop UI; detecting quarterly tax series on the regular payments
screen; any change to the «Count taxes» switch itself or its texts; the analysis copy's whitelist.

User-visible: yes. `CHANGELOG.md`, `## 0.1.15 — unreleased`: a «### Fixed» line saying taxes paid from a personal card
now show in «Spending» and their category, while the budget's «Count taxes» switch still decides only the budget
(flagged for human review before the release).

Trust anchors: none change (`recategorize` is run as is; its code and output are untouched).

Affected: `packages/core` (settings default, rules version), `apps/mcp` (scope tests), `apps/desktop` (a data test for
the budget switch), docs (`.agents/project/domain-rules.md`, `CHANGELOG.md`).

## Capabilities

### New Capabilities

- `core-spending-scope`: which operations are personal and which are business, and so which ones the personal views
  («Spending», categories, limits, budget) see.

### Modified Capabilities

None. `desktop-limits-goals` already requires that a budget not counting taxes keeps them out of the budget only, not
out of «Spending»; this change makes the data meet it.

## Impact

- `packages/core/src/people/settings.ts`: `treasury_business` default.
- `packages/core/src/derive/categories.ts`: `CATEGORY_RULES_VERSION` 2 → 3 (its comment widened to scope changes).
- `apps/mcp/tests/scope.test.ts`: the defaults test.
- `apps/desktop` data tests: taxes in personal spending and the budget switch.
- No migration, no IPC, no UI text change.
