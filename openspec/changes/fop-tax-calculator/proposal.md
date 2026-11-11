# Proposal

## Why

A sole proprietor (FOP) of the 3rd group pays a single tax as a percent of income every quarter. The user already
imports the FOP card, so the app knows the income it receives, but has to add it up and apply the rate by hand. The
team's plan (Notion, «P1. Податковий калькулятор ФОП (3 група)») asks for an estimate of the tax from that income.

## What Changes

- A new «FOP tax» screen, shown in the side menu only while an enabled business account (Monobank: a FOP account,
  the provider's `isBusinessAccount`) exists.
- The base: income on the business accounts for a quarter, without refunds and without transfers from the user's own
  (or the family's) accounts — core `incomeSummary`, all scopes, restricted to the business accounts of the view.
- A quarter picker (Q1–Q4 of a year, default the current quarter) and the year to date: from 1 January to the end of
  the picked quarter (today for the current one).
- Rate presets 5% / 1% / 6%, a custom percent, and a custom amount that replaces the base («Custom amount»).
- The tax only: percent × base, said «from income». The single social contribution (ЄСВ) is not counted and the screen
  says so; no ЄСВ amount and no deadline is stored anywhere. A disclaimer: an estimate, not tax advice.
- `DataStatus` says whether an enabled business account exists (`businessAccounts`), so the menu can hide the item.
- Minimal menu support: a route's `meta.nav` may name a condition (`when: 'business'`) the side menu checks.

Out of scope: ЄСВ amounts, tax deadlines, declarations, the military levy, other FOP groups, the NBU rate of the day
of receipt (foreign-currency income is folded at today's Monobank rate, like every other screen), income received
outside the imported business accounts, reminders.

User-visible: yes. `CHANGELOG.md`, `## 0.1.15 — unreleased`, a «### FOP tax» section (flagged for human review: the
rates, the wording and the ЄСВ note must be checked by a person before the release).

Trust anchors: none change.

Affected: `apps/desktop` only (data process, IPC contract, renderer: route, page, `features/fop-tax`, app layouts'
menu, dictionaries, tests); docs (`.agents/project/desktop-renderer.md`, `.agents/project/desktop-import.md`,
`CHANGELOG.md`, `docs/backlog.md`). No core change: `incomeSummary` and the provider rules are reused as they are.

## Capabilities

### New Capabilities

- `desktop-fop-tax`: the FOP tax estimate screen — when it is offered, its base, its period and its rates.

### Modified Capabilities

None.

## Impact

- IPC `getFopTaxOverview({ year, quarter, participantId? })` → `FopTaxOverview` (a cached read, rated).
- `DataStatus.businessAccounts: boolean`.
- `app/layouts/types.ts` `RouteNav.when`, `navGroups` / `navItems` take the conditions that hold.

## Revision (10.11.2026, before release)

The user could not find the screen (no FOP account was detected, so the menu hid it) and asked for a quick standalone
calculator. Changes to the plan above:

- The «FOP tax» item is always in the side menu; `when: 'business'` and `DataStatus.businessAccounts` go.
- The base is picked: «FOP accounts income» (only with a business account in the view; the default then), «All
  income» (the view's income, same exclusions; the default otherwise), «Custom amount».
- The period is picked with the «Analytics» month range picker (one month or a range of months, quick picks for this
  and last month, quarter and year). The year to date stays for a quarter only.
- Rate presets are 5% and 6% (1% goes), plus the user's own percent in a field next to them.
- IPC: `getFopTaxOverview({ from, to, base: 'business' | 'all', participantId? })` → the base of `from..to` and, when
  asked, of the year to `to` (`yearToDate: boolean`); `available` says whether the view has a business account.
