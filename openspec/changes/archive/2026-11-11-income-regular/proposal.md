# Proposal

## Why

The income screen shows where money came from but not what the user can count on. Testing asked for a regular income
figure, a table of sources with how often they pay and when the next payment is expected, and how much of the regular
income the regular payments take (Notion, «New Income page»).

## What Changes

- A header on the income screen: «Regular income: X a month» and «≈ N% of it goes to regular payments» (the monthly
  sum of active regular payments over the regular income).
- A «Regular sources» table: source, typical amount, how often (about monthly), last received, next expected, and a
  mark — «on time», «late by N days», or «amount changed by N%» against its usual amount.
- «Expected in the next 30 days»: the sources due in that window with their typical amounts, tooltip «Based on how
  often this source paid you before».
- Sources come from core `findRecurring` with `kind: 'income'` (already used by «Available per day»); no new
  detector. Sender names are cut the same way as the income list (the income screen already carries them).

Out of scope: a 12-month chart per row; income forecasts beyond 30 days; income that is not regular.

User-visible: yes. `CHANGELOG.md`, the next unreleased version, «### Income» (flagged for human review).

Trust anchors: none change.

Affected: `apps/desktop` (data process `incomeOverview`, `features/income-detail`, dictionaries, tests).

## Capabilities

### New Capabilities

- `desktop-income-regular`: the regular income on the income screen — the monthly figure, its sources and what is
  expected next.

### Modified Capabilities

None.

## Impact

- `IncomeOverview.regular` (a month's view only): `monthly`, `coveredByPayments` (per cent or null), `sources[]`
  (`name`, `usual`, `last`, `next`, `late` days or null, `change` per cent or null).
- `features/income-detail`: `RegularIncomeHeader`, `RegularSources`, `ExpectedIncome` components and their pure view
  functions in `utils.ts`.
