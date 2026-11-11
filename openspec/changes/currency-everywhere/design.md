# Design

## Context

See proposal.md — Why. `entities/currency-display` already holds the choice (`useCurrencyDisplayStore`), the formatter
(`moneyFormat` → `MoneyFormat` with `money`, `approx`, `approxInline`, `alsoParts`) and `useMoneyFormat`. Features build
view models in `utils.ts` and decide each one whether to fill a `conv` / `approx` field; most do not. Transaction rows
(`entities/operations` `OperationRow`, fed by `features/category-detail` and `features/income-detail` utils) carry
`original` — the operation's own currency when it differs from the account's.

Follows `.agents/project/desktop-renderer.md` (FSD, "`shared/ui` first", interface texts). No new UI text: the lines
are amounts only.

## Goals / Non-Goals

**Goals:** one part draws every amount with its extra lines; each view model carries the lines; the operation row knows
its exact currency.

**Non-Goals:** restyling rows (the `ui-refresh` change does that); new rates; per-screen settings.

## Decisions

### `MoneyStack` in `entities/currency-display`

Props: `amount` (the main figure's text), `also` (`ReadonlyArray<string>`, the lines), `align` (`end` default),
`size` (`sm | md`), plus a class for the figure. It renders the figure and the lines (`text-xs text-foreground-muted
tabular-nums whitespace-nowrap`). An entity, not `shared/ui`: it is about the currency choice. The category rows'
`AmountCell` becomes a thin use of it.

Alternative: each feature keeps its own markup and only fills `approx` — rejected: the look would drift again, which
is how the gaps appeared.

### View models carry `also: string[]`

Every row or figure view that has an amount gets `also`, filled by `fmt.approx(kopecks)` in the feature's utils. Tests
read the view models and the rendered text.

### Exact line for an operation

`MoneyFormat` gets `alsoFor(kopecks, op: { amount, currency } | null)`: for each picked currency, the exact
`formatMoney(op.amount)` when `op.currency` is that currency, else «≈ …». `original` is shown only when the operation's
currency is neither the main one nor picked. An account in a picked currency (a euro card) is exact the same way (its
own amount).

### Charts

The chart utils (`features/category-detail` day bars, `features/analytics-overview` lines and bars,
`features/insights-page` health) add `fmt.approxInline` to the tooltip formatter; labels stay.

## Risks / Trade-offs

- [Rows get taller with two or three picked currencies] → lines are `text-xs`; with none picked nothing changes; the
  user checks dense lists in the app (`docs/backlog.md`).
- [Overlap with `ui-refresh`, which also touches rows] → this change lands first in the same branch; `ui-refresh`'s
  `VListRow` takes `MoneyStack` in its trailing slot.
- [Many renderer tests read amounts] → jsdom has no picked currency by default, so existing texts stay; new tests turn
  one on.
