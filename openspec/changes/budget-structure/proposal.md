# Proposal

## Why

The app shows what was spent and what is unusual, but not whether the budget is healthy, and it has no way to set a
plan and follow it. The Notion page «Фінансова грамотність» plans this without AI, by formulas in core: E1 (category
kinds) is the base, E2 (limits, merged with «Цілі та ліміти» of the development plan) lets the user set a plan, E3
(diagnostic metrics) shows how the month went. The user asked (01.11) to start financial literacy now that the
Insights screen is merged, to fold «Цілі та ліміти» into this change, and agreed the UI/UX presentation and its four
decisions (01.11).

## What Changes

### Category kinds (E1)
- Every spending category has a kind — «Essential», «Wants» or «Savings» — and a «Fixed» flag (about the same amount
  every month). Core holds a default for each; the user can change any category and reset one or all. The choices are
  stored apart from transactions, so no import, re-upload or re-derivation touches them. Not spending categories (own
  transfers, income, «To family») have no kind.
- Defaults (the user may change any): essential — groceries, taxi and transport, pharmacies and health, telecom and
  digital services (fixed), insurance (fixed), taxes, utilities (fixed), education (fixed), rent (fixed), car, kids,
  pets, installments and loans (fixed), bank fees, transfer fees; wants — cafes and restaurants, beauty, clothing, home
  and electronics, entertainment, travel, sport, delivery, flowers and gifts, marketplaces, charity, subscriptions
  (fixed), cash, transfers to people, other; savings — investments.
- A **«Categories» section** in the settings screen: each category with a three-way kind choice and a «Fixed» switch,
  a mark on the ones changed, «Reset to defaults».

### Budget metrics (E3)
- Pure functions in core, each with its guide from the Notion page, shown as a guide and never as a grade: the
  **50/30/20** split of a finished month's income (essential, wants, what is left), the **fixed** share of income, the
  **debt payments** share («installments and loans» only), the **reserve** in months (own money now in cards and jars
  ÷ a usual month's essential spending).
- A **«Budget structure» card** on the Insights screen, first in the side column, with «How it was counted» and a link to the
  «Categories» section.

### Limits (E2)
- **Category limits**: a category, an amount (₴, $ or €, counted at today's rate), a period — day, week (Mon–Sun) or
  month — and an owner — a person or the family.
- **A monthly budget** for all spending: the user enters one total (say 2 000 €) and its own list of fixed costs — a
  category and an amount they type, nothing filled in for them, each row removable. The fixed costs are set aside
  first; the rest (750 € with rent of 1 250 €) is the flexible part, and the pace, forecast and «per day» count on it
  only. Spending above a fixed row's amount counts against the flexible part. The «Fixed» flag of the «Categories»
  section does not change the budget; it feeds only the fixed-cost metric of the «Budget structure» card. Rent paid as a
  transfer to a person counts as flexible until the user sets that payee's category to rent with the existing category
  menu; the app does not guess it (decisions of 01.11).
- **The budget sheet**: one sheet with a live result beside the form — the total with quick choices from the usual
  month, «Add a fixed cost» (pick a category, type the amount, remove a row), the owner; the result shows the total,
  each fixed row taken off, the flexible part and its average per day, and the past months' flexible spending against
  it. «Save» waits until every row has an amount.
- **A «Budget» row on home**, over the whole width between «Balance / Month pace / Month» and «Today / This week»: the
  total, fixed costs paid of their amounts, the flexible part with the pace marker, state and forecast, and «per day by
  the budget». A past month shows the result. Without a budget, the place stays as a light empty row saying a budget can be set
  right here, with «Set a budget»; it has no close button.
- **«Month pace» no longer shows «Available per day»**: on home, per day is the budget's; «Available per day» stays in
  «Planning». «Month pace» and the budget row both stay (decision of 01.11).
- For each limit: spent, left, per cent, the expected pace for today, the forecast for the period's end, «per day»
  until the end. States: **on track** under 80%, **attention** at 80–100% or when the forecast is over the limit,
  **exceeded** over 100%. A state is always words and an icon, never colour alone.
- Limits count like «Spending»: refunds lower it, transfers between own accounts are left out, pending holds count;
  only «Personal» spending; every bank, whatever the bank filter. A family limit counts everyone; a person's counts
  their accounts. A person's view shows their limits and the family's (decision 2).
- **Suggested amounts**: the median of the category's (or flexible spending's) whole months, 3–6, scaled to the period;
  «Suggest limits» on the empty screen offers them for the biggest flexible categories at once.
- A **«Budget» screen** attached to home's «Budget» row like a category screen — no menu item, nothing new in
  «Planning»: the monthly budget on top, limits sorted by state, a sheet to add or
  edit one with the suggestion and a preview of the past months against it.
- **The category screen** shows the category's limit for the current period with the pace marker, or a quiet «Set a
  limit».
- **Home**: a «Limits» slide in the «What's unusual» / «Recent operations» tile, listing only limits in attention or
  exceeded; first when one is exceeded (decision 4).
- **Insights**: a «Limit exceeded» line in the feed for a month's exceeded monthly limit.

### Savings goals (E2)
- A goal: a name, a target amount (₴, $ or €), an optional date, an owner, and where its progress comes from: one
  Monobank jar (its target is offered when picked) or «cards and jars» of the owner (decision 3; a manual amount later).
- Progress, what is left and, with a date, how much is needed per month. Shown on the «Budget» screen.

### Explanations for the user
- Every metric, limit and goal figure has a «?» that explains it in plain words: what it means, the formula in words
  and the same formula with the user's own numbers («(4 000 ₴ − 1 900 ₴) ÷ 21 days = 100 ₴»), and what is counted and
  what is left out (refunds, own transfers, pending holds, «Personal» only, every bank, fixed and savings categories).
- The «Budget» screen, the «Categories» section and the «Budget structure» card open with a short introduction on the
  first visit, closed once and brought back by «How it works». Guides like 50/30/20 are introduced as common advice.

### CHANGELOG
`CHANGELOG.md` (0.1.13, unreleased): «Plan your money: set one monthly budget — the fixed costs you list, like rent, are
set aside first, so the pace follows what you can control, right on the home screen — or limits on categories, and
see your pace, the forecast and how much you can spend per day; follow savings goals backed by a jar; and
see in «Insights» how your income splits against the 50/30/20 guide, how much goes to fixed costs and loans, and how
many months your money would last. Every number has a «?» that explains how it is counted. Every category is now essential, a want or savings — change it in Settings →
«Categories».»

## Capabilities

### New Capabilities
- `core-category-kinds`: kinds and the fixed flag, defaults, the user's choices stored apart from transactions.
- `core-budget-metrics`: 50/30/20 split, fixed share, debt share, reserve months.
- `core-spending-limits`: limits and the monthly budget (a total with fixed costs set aside) — storage, counting, pace, forecast, states, suggestions.
- `core-savings-goals`: savings goals — storage, progress sources, need per month.
- `desktop-category-kinds`: the «Categories» section.
- `desktop-budget-help`: the «?» explanations with the user's own numbers and the first-visit introductions.
- `desktop-limits-goals`: the «Budget» screen opened from home, the add/edit sheet, the category screen's
  limit bar.

### Modified Capabilities
- `desktop-insights-page`: the «Budget structure» card and the «Limit exceeded» line.
- `desktop-home-highlights`: the tile gains a «Limits» slide.
- `desktop-home-tiles`: home gains the «Budget» row between the first and the second row, and its empty row when there is no budget.
- `desktop-balance-cards`: «Month pace» drops «Available per day».

## Impact

- `packages/core`: migrations (`category_kinds`, `goals`), `read/category-kinds.ts`, `read/budget.ts`,
  `read/limits.ts`, `read/savings-goals.ts`, commands for kinds and goals, tests.
- `apps/desktop`: data process (`insightsOverview` gains `budget`, `categoryOverview` gains `limit`, a new
  `limitsOverview` read, channels to read and write kinds and goals), IPC, renderer (settings section, Insights card,
  «Budget» screen, category bar, home row and slide), i18n `uk` / `en` / `ru`, `CHANGELOG.md`.
- `apps/mcp`: none. The analysis copy: none (the new tables are not whitelisted; goal names are the user's text).
- Trust anchors: none change.
- User-visible: yes, the CHANGELOG entry above.

## Out of scope

- Rolling a limit's rest over, limit history («met in N of 12 months»), notifications at 80% / 100% (P2 in Notion).
- A manual progress amount for a savings goal; goals funded by a share of each income.
- Lifestyle inflation, credit limit use, «pay yourself first», irregular-expense funds, net worth, the health index
  (E3 rest, E4–E6).
- Changing how «Available per day» counts, or taking limits or goals off it (a later change); it only leaves «Month
  pace».
- A budget line on the «Month pace» chart (a later step).
- Kinds per person; kinds, limits or goals in MCP tools or the analysis copy.
