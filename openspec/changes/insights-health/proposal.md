# Proposal

## Why

The Insights screen lists what changed but not where the user stands: the «Signals» figure is a line of counts joined by
dots, the 50/30/20 shares sit in a side card with no sense of direction, and new payees and one-offs live in two side
lists that cannot be filtered with the rest. The user asked (06.11, from a mockup) for a cleaner signals figure, a
progress chart of the financial state, marks that say which figures are within their guide, and filters for the signals.

## What Changes

- **«Signals» at a glance**: the count, then a bar split by severity (high / medium / low) with each count labelled
  under it, instead of «4 high · 1 medium · 12 low». It counts every item of the feed, payee signals and limits included.
- **«Financial health» block**, under the glance, full width:
  - left — a line of the share of income left after essential and wants spending (the 50/30/20 «left») for each whole
    month the usual covers (up to 6) and the shown month when it is finished, with the 20% guide as a dashed line; a
    switch shows the wants share against its 30% guide instead;
  - right — a checklist of figures against their guides: what is left ≥ 20%, essential ≤ 50%, wants ≤ 30%, fixed costs
    ≤ 60%, loan payments ≤ 30% of income, the reserve ≥ 3 months (today's figure only) and the monthly limits not
    exceeded. Each item is «within the guide», «near the guide» or «outside the guide», shown by a coloured circle
    **and** an icon (check, dash, cross) **and** its figure; the words stay neutral, never «good / bad». The income bar
    against 50/30/20 and every «?» explanation of «Budget structure» move into this block.
  - **BREAKING (spec)**: replaces the «Budget structure» card, which promised no grade colour.
- **Filters on the feed**: by severity (All / High / Medium / Low, each with its count) and by kind (Spending up,
  Spending down, Income, Limits, New payees, One-offs). New payees and one-offs join the feed as their own cards, ranked
  by money with a severity by the same rule; the two side lists go. A filter with nothing in it says so and offers to
  reset. The chosen filter is remembered on this computer (`localStorage`) and applies to every month.

## Capabilities

### New Capabilities
- `desktop-insights-health`: the «Financial health» block of the Insights screen — the shares chart and the checklist
  against guides.

### Modified Capabilities
- `desktop-insights-page`: the glance's signals figure; the feed takes payee signals and gets filters; «Payee signals»
  and «Budget structure card» are removed (moved into the feed and into `desktop-insights-health`).
- `core-budget-metrics`: the 50/30/20 shares for each whole month of the usual; where a figure stands against its guide
  (within / near / outside) as a core rule.

## Impact

- `packages/core`: `read/budget.ts` — shares per month and the guide status, pure; `read/insights.ts` — severity of a
  new payee and of a one-off by the existing rule.
- `apps/desktop`: the data process (`data/data.ts`, `insightsOverview`: the history from the usual's months already
  read — no new query), the contract `src/shared/api.ts` (`InsightsOverview.history`, severity on payee signals), the
  renderer `features/insights-page` (glance, health block, filters, feed) and the dictionaries `uk.json`, `en.json`,
  `ru.json`.
- No IPC channel, storage, network or security change; no new bank text crosses to the renderer. No trust anchor changes.
- User-visible: a `CHANGELOG.md` entry under `## 0.1.14 — unreleased`, «Insights: financial health and signal filters».

**Out of scope**: the reserve's history (needs month-end balances, not available reliably); home's «Insights» block and
«What's unusual» slide (unchanged); filters elsewhere; new detectors or changed thresholds; a combined «score».
