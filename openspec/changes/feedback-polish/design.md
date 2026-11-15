# Design

## Context

Follows `.agents/project/desktop-renderer.md` (FSD, «`shared/ui` first», i18n, the bars' style: thin rounded bars on
a sunken track, soft tints) and updates it. Renderer only; the figures all exist already.

## Goals / Non-Goals

**Goals:** each item of the feedback fixed where it lives, with the smallest change; no new numbers.

**Non-Goals:** new signals or thresholds in core; restyling screens that were not named.

## Decisions

### 1. Past months' chart (bug)
`PastBars.vue`: a bar's `height: N%` sits in a column wrapper without a definite height, so it resolves to nothing.
The wrapper takes the row's full height and aligns to the bottom. A renderer test asserts a non-zero height style and
the wrapper's full height class.

### 2. Bar levels
- A fourth look `strong` in `entities/goal` (`StateLookName`), between `attention` and `exceeded`. Renderer rule, from
  the figures the view already has: state is `attention` and (`spent ≥ STRONG_PACE × expected`, with `expected > 0`
  and reason `pace`) or (`forecast` shown and `forecast ≥ STRONG_FORECAST × amount`). `STRONG_PACE = 2`,
  `STRONG_FORECAST = 1.5`, in `entities/goal/constants.ts`.
- Colour: one new theme token `--warning-strong` (both themes, between `--warning` and `--danger`, hue toward
  orange-red; AA against the chip's text as the others) — fill and chip. Icon as `attention`. Words unchanged
  («Faster than plan by … (×2.1)»), so the state never rests on colour alone.
- Verdict against putting the rule in core: it is a look, not a figure; core's states and the Insights signals stay
  as they are.

### 3. The bar past the limit
`LimitBar` when `state` is `exceeded` and spent > amount: the track is the scale of `spent`. The solid fill
(`--danger`) covers `amount / spent`; the rest is hatched (a `repeating-linear-gradient` of `--danger` at reduced
alpha, 45°); a tick marks the limit; the pace marker is placed on the same scale. `limitLook` gives `fill` (the
limit's share of the scale), `over` (the hatched share) and the scaled `pace`. A bar not exceeded is unchanged.
Honours `prefers-reduced-motion` (no animation added). Alternative — a bar that overflows its track: rejected, it
breaks the row's width and the card's clip.

### 4. Home lists seven categories
`CategoryList` shows every row `rowsFor` gives (seven named and the «N more categories» link); the fold button and
`SHOWN_ROWS` go. Keys `home.spending.showMore` / `showLess` are removed from the three dictionaries if nothing else
uses them.

### 5. Back to «All categories»
`categoryLink` takes an origin; the «All categories» screen passes it, and it travels as `from=categories` in the
query (`categoryRequest` reads it back, unknown values ignored). `BackLink` (`entities/operations`) takes an optional
`to`; the category screen gives it `spendingCategoriesLink()` and the label «All categories» when the origin is set,
else home as now. Verdict against `router.back()`: wrong after a reload or a direct link, and the label could not say
where it goes.

### 6. «What's unusual»
- **One list.** The feed is one card; items are rows divided by hairlines (not a card each). Insight and signal rows
  share one shape: icon · title and one sentence under it · on the right the amount (the change chip for an insight,
  the amount for a signal) with its «≈» line under it · a severity mark · a chevron when the row has details.
- **Severity** is a small coloured dot before the title with the word for screen readers; the word chip stays only on
  «High» rows. Fewer chips per row.
- **Details on demand.** A row with details is a disclosure (`aria-expanded`, Enter / Space): opened, it shows the
  months chart at full row width with a caption («Last 6 months and this one») and a legend («this month», «other
  months», «dashed line — your usual month: 79 €»), the payee line and the link. High rows start opened, so the
  strongest signals still explain themselves; the rest start folded.
- **Filters.** One row: severity toggles with counts, as now; kinds become a `VSelect` («All kinds» …) at the row's
  end. The remembered filter keeps its shape.
- **«How it was counted»** becomes a folded disclosure under the feed, one line until opened.
- Components: `InsightCard` + `SignalCard` → `FeedRow.vue` (one row) and `FeedDetails.vue`; `InsightBars` gains the
  caption and legend; `FeedFilters` the select. View types change in `types.ts` / `utils/feed.ts` only as the row needs.
- Alternative — keep cards and only trim them: rejected, the different shapes are the noise.

## Risks / Trade-offs

- Folded rows hide the chart of medium and low items: one click away, and the sentence still says the numbers.
- A new colour token widens the palette by one; it is used only for this level.
- The Insights tests are many and tied to the cards' markup: they are rewritten with the rows, keeping what they assert.
