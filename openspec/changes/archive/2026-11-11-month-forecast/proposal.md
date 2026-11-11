# Proposal

## Why

The Insights screen's «The month at a glance» says how much of a usual month is spent while the month runs, but not
where the month is heading. The team's Notion page («Прогноз, регулярні платежі і базові vs змінні», the forecast part)
asks for a month-end forecast that adds what is still certain to come (the regular payments due before the month ends)
to what the user usually spends a day.

## What Changes

- A fifth figure in «The month at a glance», for the running month only: «Forecast based on your plan» — spent so far
  + the regular payments still due this month + the typical day × the days left, with a range «from … to …» under it
  and a «?» (`VHelpHint`) giving the formula in the user's numbers. Amounts follow the main currency and the «Show
  also» lines like the other figures.
- A finished month, or a month without a usual (fewer than 3 whole months), shows no forecast figure.
- The data process computes it in `insightsOverview` (`InsightsOverview.forecast`); the pure arithmetic lives in a new
  `apps/desktop/src/data/forecast.ts`. Regular payments come from core `findRecurring`, already used by the regular
  payments screen; no new detector and no core change.

Out of scope: a forecast on home or on the «Budget» screen; a forecast of income or of the kept share (the «Financial
health» left-share forecast stays as it is); per-category forecasts; regular payments that are late (due before today
and not paid yet); a chart of the forecast.

User-visible: yes. `CHANGELOG.md`, `## 0.1.15 — unreleased`, a new «### Insights» section (flagged for human review).

Trust anchors: none change.

Affected: `apps/desktop` only (data process `insightsOverview`, `data/forecast.ts`, `shared/api.ts`,
`features/insights-page`, dictionaries, tests). `packages/core` and `apps/mcp` are untouched.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `desktop-insights-page`: «The month at a glance» gains the running month's forecast figure.

## Impact

- `InsightsOverview.forecast`: `{ value, low, high, spent, regular, regularCount, perDay, perDayLow, perDayHigh, daysLeft }`
  in hryvnia kopecks, or null (a finished month, no usual).
- `features/insights-page`: `GlanceView` gains the `forecast` key, an optional range line and an optional help
  (title + lines); `InsightsGlance` renders them; keys under `insights.glance.forecast*` in uk / en / ru.
