# Proposal

## Why

«What's unusual» says which categories are off, but not why, nor how the usual month was worked out, and a month that is
over gives no view of how much of the income was kept. The Notion insights plan («Специфікація: Інсайти», «План
розвитку» → «Інсайти») lists the main driver, the «how it was counted» hint and positive insights such as the savings
rate as the missing pieces. The user chose (01.11) to give them a block of their own beside «Spending», where home has
room since «Who spent what» left, and to keep the carousel («What's unusual» / «Recent operations») as it is: no more
slides in one tile.

## What Changes

- **An «Insights» block beside «Spending».** On a wide home (12 columns) «Spending by category» takes 7 columns and
  the new block 5; on narrower homes the block takes the whole row under «Spending». The block is shown only when it has
  something to say; otherwise «Spending» keeps the whole row, as now.
- **Main driver of each unusual category.** For every category line of «What's unusual» (at most five), the payee whose
  own change against its usual explains most of the category's change: its name (the bank's description, cut as in
  «Recent operations»), its change in money and its share of the category's change. Shown only when that payee accounts
  for at least 30% of the change; a row opens the category screen, like the carousel's.
- **Savings rate for a month that is over.** The share of the month's income left after the month's spending, beside
  the usual share (the median of the same rates over the whole months behind the usual). Shown only for a month that is
  over, with income in it and at least 3 usual months with income. A negative rate reads as «spent more than earned».
- **«How it was counted».** A short note at the bottom of the block: the usual is the median of N whole months (first –
  last month), transfers between own accounts are left out, refunds lower spending, holds still pending are counted (and
  how many). It is part of the block, not a reason to show it.
- **Payees on home.** The block shows bank descriptions, as «Recent operations» does; this widens the user's 01.11
  approval («descriptions on home: this list only») to the drivers. **Needs the user's ok in this review.**
- **`CHANGELOG.md`**, under the next unreleased version (`0.1.13 — unreleased`, Home): «An «Insights» block beside
  «Spending» shows which payee drove each unusual category, how much of the income a finished month kept against the
  usual, and how the usual is counted.»

## Capabilities

### New Capabilities
- `desktop-home-insights`: the block beside «Spending»: when it shows, the drivers, the savings rate and the note.
- `core-insight-explain`: the pure rules in core for the main driver and the savings rate (thresholds, shares, medians).

### Modified Capabilities
- `desktop-home-tiles`: «Home is a grid of tiles» — «Spending by category» no longer always spans the whole row; it
  shares it with the «Insights» block when that block has content.

## Impact

- `packages/core`: `src/read/insights.ts` gains the driver and savings-rate rules (pure, no SQL); tests in
  `tests/read/insights.test.ts`. No migration, no stored data.
- `apps/desktop`: `SpendingOverview` gains the drivers, the savings rate and the note's facts (`DataService`,
  contract `api.ts`; no new IPC channel, so the spending block and the new block share one request); a new feature slice
  `features/home-insights`; `HomePage` and `SpendingFeature`'s span; i18n keys in `uk.json`, `en.json`, `ru.json`;
  `.agents/project/desktop-renderer.md`, `.agents/project/desktop-import.md` (one more channel with descriptions),
  `.agents/project/domain-rules.md`; `docs/backlog.md` live checks.
- `apps/mcp`: untouched.
- Trust anchors: none change.
- User-visible: yes; the `CHANGELOG.md` entry above.

## Out of scope

- The Insights page and an «All insights» link; severity levels.
- Insights beyond the top five, P2 detectors (new merchants, a dearer subscription, large one-off operations,
  duplicates), «this is expected».
- Merging the two notices at the top (incomplete month, holds) into one data status.
- «Sort out» for «Other», bulk category edits.
- Where «Who spent what» and the regular payments teaser go.
- A cache of aggregates for 36 months of history.
