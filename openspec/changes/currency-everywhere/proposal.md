# Proposal

## Why

The currency choice on home has «Show also» currencies, but only a few figures show them: the spending total and
ring, the category rows of «Spending», «Now», the category and income screens' totals, the regular payments' monthly
sum, the balances' month and the account cards. Transaction tables, the category screen's breakdowns, recent
transactions, limits, the budget, analytics and insights show the main currency only. A user who spends in two
currencies wants to see each amount in both, above all in tables and category lists.

## What Changes

- One shared amount part shows the main figure with one quiet «≈» line per picked «Show also» currency under it, the
  look the category rows of «Spending» have today. Every amount in a list, a table row or a block's headline goes
  through it.
- Transaction tables (category, income screens and anywhere `OperationRow` is used): under the amount, each picked
  currency; when the transaction itself was in a picked currency, that line is the exact amount, without «≈», and is
  not shown twice. The original currency line stays for a currency that is not picked.
- The category and income screens: «Who spent», the payee list, the split by bank and by part of day, the list total.
- Home: recent transactions, the «Limits» slide, the budget row.
- Planning: limit and goal rows, the budget panel, regular payment rows, «Available per day».
- Analytics and Insights: list rows and cards; charts show the picked currencies in their tooltips only (labels on
  bars stay in the main currency, so they fit).
- No new setting: the existing «Show also» switches decide. Nothing changes while none is picked.

Out of scope: the currency choice itself, rates and their source, the MCP tools, totals in mixed currencies.

User-visible: yes. `CHANGELOG.md`, `## 0.1.15 — unreleased`, «### Currencies»: the «Show also» currencies now appear
next to every amount in tables and lists (flagged for human review before the release).

Trust anchors: none change.

Affected: `apps/desktop` renderer only (entities, features, widgets); no IPC, no data process change (rates are
already in every answer that has amounts).

## Capabilities

### New Capabilities

- `desktop-currency-display`: the main currency and the «Show also» currencies — which amounts show the extra
  currencies and how.

### Modified Capabilities

None.

## Impact

- `entities/currency-display`: a new amount part (`MoneyStack`) and a formatter for an operation's exact amount.
- Lists and rows in `entities/operations`, `features/category-detail`, `features/income-detail`,
  `features/recent-operations`, `features/home-budget`, `features/limits-goals`, `features/recurring-payments`,
  `features/daily-allowance`, `features/analytics-overview`, `features/insights-page`, `features/spending-summary`.
- Renderer tests per area (texts with and without «Show also» currencies).
