# Proposal

## Why

The app shows what was spent and what is unusual, but not whether the budget is healthy: how much goes to what must be
paid, how much to what is wanted, what is left, how much is locked in fixed payments and how long the money on hand
would last. The Notion page «Фінансова грамотність» plans this without AI, by formulas in core: E1 (category kinds) is
the base for everything else, E3 (diagnostic metrics) is the first thing the user sees from it. The user asked (01.11)
to start financial literacy now that the Insights screen is merged.

## What Changes

- **Category kinds (E1).** Every spending category has a kind — «Essential», «Wants» or «Savings» — and a «Fixed» flag
  (the same amount every month, like rent or a subscription). Core holds a default for each category; the user can
  change any category's kind and flag, and reset one or all to the defaults. The choices are stored apart from
  transactions, so no import, re-upload or re-derivation touches them. Not spending categories (own transfers, income,
  «To family») have no kind.
- **Defaults** (the user may change any of them):
  - Essential: groceries, taxi and transport, pharmacies and health, telecom and digital services, insurance, taxes,
    utilities (fixed), education (fixed), rent (fixed), car, kids, pets, installments and loans (fixed), bank fees,
    transfer fees; telecom and insurance are also fixed.
  - Wants: cafes and restaurants, beauty, clothing, home and electronics, entertainment, travel, sport, delivery,
    flowers and gifts, marketplaces, charity, subscriptions (fixed), cash, transfers to people, other.
  - Savings: investments.
- **A «Categories» section** in the settings screen: every category with its icon, a three-way kind choice and a
  «Fixed» switch, a mark on the ones changed from the default, «Reset to defaults» for all. A change applies at once.
- **Budget metrics (E3)** — pure functions in core, each with its reference range from the Notion page, shown as a
  guide, never as a grade:
  - **50/30/20**: essential, wants and what is left (income − essential − wants, investments included) as shares of a
    finished month's income; guide 50 / 30 / 20.
  - **Fixed costs**: fixed spending as a share of income; guide: above 50–60% leaves the budget little room.
  - **Debt payments**: «installments and loans» as a share of income; guide: under 30%. Only what the category holds —
    credit card repayments are not visible as such.
  - **Reserve**: own money now (cards and jars of the view, credit money not counted, other currencies at today's rate)
    divided by a usual month's essential spending (median of the whole months, as for insights); guide 3–6 months.
- **A «Budget» card on the Insights screen**, first in the side column: one stacked bar of the month's income split
  into essential / wants / left with the 50/30/20 marks, then three rows — fixed costs, debt payments, reserve — each
  with its value, the guide in plain words and «How it was counted». A running month shows only the reserve and says
  the shares come once the month is over; a month without income says so; fewer than 3 whole months — no reserve. A
  «Change category kinds» link opens the new section.
- **`CHANGELOG.md`** (0.1.13, unreleased): «Budget at a glance: each category is now essential, a want or savings, and
  fixed or not — change any in Settings → «Categories». The «Insights» screen shows how a month's income splits against
  the 50/30/20 guide, the share of fixed costs and of loan payments, and how many usual months the money you have would
  cover.»

## Capabilities

### New Capabilities
- `core-category-kinds`: the kinds and the fixed flag, the defaults, the user's choices stored apart from transactions.
- `core-budget-metrics`: 50/30/20 shares, fixed share, debt share, reserve months (pure rules in core).
- `desktop-category-kinds`: the «Categories» section where the user changes kinds and flags.

### Modified Capabilities
- `desktop-insights-page`: the screen gains the «Budget» card.

## Impact

- `packages/core`: a migration (`category_kinds`), `read/category-kinds.ts` (defaults and reading), a command to set
  and reset, `read/budget.ts` (metrics) with tests.
- `apps/desktop`: data process (`insightsOverview` gains `budget`; new channels to read, set and reset kinds), IPC and
  the renderer (settings section, Insights card), i18n `uk` / `en` / `ru`, `CHANGELOG.md`.
- `apps/mcp`: none. The analysis copy: none (the new table is not whitelisted).
- Trust anchors: none change.
- User-visible: yes, the CHANGELOG entry above.

## Out of scope

- Limits on categories (E2): they are a goal type in «Planning», a separate change.
- Credit limit use, lifestyle inflation, «pay yourself first», irregular-expense funds, net worth, the health index
  (E3 rest, E4–E6).
- Kinds per person (one set for the whole database), kinds in MCP tools or in the analysis copy.
- Changing «Available per day» or home: the metrics are on the Insights screen only.
