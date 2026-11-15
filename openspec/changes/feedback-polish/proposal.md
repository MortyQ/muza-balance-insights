# Proposal

## Why

Feedback from using 0.1.16's builds:

- The budget sheet's «Flexible spending in past months» chart shows no bars (a layout bug).
- A budget bar looks the same at 1.3× and at 2.1× its plan, and once the limit is passed the bar is simply full: how
  far past it is cannot be seen.
- Home's «Spending» lists 4 categories before «Show more»; the user wants more of them at once.
- Back from a category opened on «All categories» goes home instead of back to that list.
- «What's unusual» on the Insights screen reads as noise: two rows of filter pills, cards of different shapes, a chip,
  a second amount line, a sentence, a payee line, a link and a small chart whose meaning is not said anywhere. Users
  report they do not understand it.

## What Changes

- **Past months' chart**: the bars render (fix).
- **Bar levels**: a limit's or the budget's bar gets a fourth look between «attention» and «exceeded» — «well ahead» —
  when spending is at least twice the plan by today or the forecast is at least one and a half limits. Its chip and
  bar are orange-red; words stay as now.
- **Past the limit**: an exceeded bar is drawn to the scale of what was spent — the limit's part solid, the part above
  it hatched, a tick at the limit — so the overrun is visible at a glance.
- **Home**: «Spending» lists its seven named categories and the «N more categories» link without a fold.
- **Back to the list**: a category opened from «All categories» goes back to «All categories».
- **«What's unusual»**: one list instead of separate cards; every row has the same shape (icon, title, one sentence,
  the amount); details — the months chart with a caption and legend that say what it shows, the payee behind the
  change, the link — open on demand; the two rows of filter pills become one row (severity with counts) and a «Kind»
  select; «How it was counted» folds into one line that opens.

Affected: `apps/desktop` (renderer only). User-visible: `CHANGELOG.md` entries under 0.1.16. No trust anchor changes.

Out of scope: which signals exist, their ranking, thresholds and texts' meaning; core; the health block and the
month-end forecast on the Insights screen; the budget's rules.

## Capabilities

### New Capabilities

None.

### Modified Capabilities
- `desktop-limits-goals`: bar levels and the bar past the limit.
- `desktop-home-tiles`: how many categories «Spending» lists.
- `desktop-spending-categories`: back from a category returns to the list.
- `desktop-insights-page`: the feed's rows, details on demand, filters, «How it was counted».

## Impact

- Renderer: `entities/goal` (bar, state look), `features/limits-goals` (`PastBars`), `features/spending-summary`,
  `features/category-detail`, `shared/config/category.ts`, `features/insights-page`, three dictionaries, `theme.css`
  only if a new token is needed.
- Docs: `.agents/project/desktop-renderer.md`, `CHANGELOG.md`, `docs/backlog.md`.
